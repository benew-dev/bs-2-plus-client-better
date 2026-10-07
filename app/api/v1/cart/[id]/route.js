// app/api/v1/cart/[id]/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
// eslint-disable-next-line no-unused-vars
import Cart from "@/backend/models/cart";
// eslint-disable-next-line no-unused-vars
import Product from "@/backend/models/product";
import { captureException } from "@/monitoring/sentry";
import { withCartRateLimit, withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  extractUserInfoFromRequest,
  isAuthenticatedUser,
} from "@/lib/auth-utils";

/**
 * DELETE /api/v1/cart/[id]
 * Version mobile : supprime un élément du panier.
 * Rate limit: cart.remove (50 req/min, ultra permissif, pas de blocage)
 */
export const DELETE = withCartRateLimit(
  async function (req, context) {
    let id;
    try {
      // Next.js 15 : params est une Promise dans les route handlers
      ({ id } = await context.params);

      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid cart item ID format",
            code: "INVALID_ID",
          },
          { status: 400 },
        );
      }

      const user = await isAuthenticatedUser();

      await dbConnect();

      const cartItem = await Cart.findById(id).populate(
        "product",
        "name price",
      );

      if (!cartItem) {
        return NextResponse.json(
          {
            success: false,
            message: "Cart item not found",
            code: "CART_ITEM_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (cartItem.user.toString() !== user.id.toString()) {
        console.warn("🚨 Unauthorized cart deletion attempt:", {
          userId: user.id,
          cartItemId: id,
          cartItemOwnerId: cartItem.user,
          timestamp: new Date().toISOString(),
          ip:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "unknown",
        });

        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized",
            code: "UNAUTHORIZED_DELETE",
          },
          { status: 403 },
        );
      }

      const deletedItemInfo = {
        productId: cartItem.product?._id,
        productName: cartItem.product?.name,
        quantity: cartItem.quantity,
        price: cartItem.product?.price,
      };

      await Cart.findByIdAndDelete(id);

      const cartItems = await Cart.find({ user: user.id })
        .populate("product", "name price stock images isActive")
        .sort({ createdAt: -1 })
        .lean();

      const formattedCart = cartItems
        .filter((item) => {
          return (
            item.product &&
            item.product.isActive !== false &&
            item.product.stock > 0
          );
        })
        .map((item) => {
          const adjustedQuantity = Math.min(item.quantity, item.product.stock);
          const subtotal = adjustedQuantity * item.product.price;

          return {
            id: item._id,
            productId: item.product._id,
            productName: item.product.name,
            price: item.product.price,
            quantity: adjustedQuantity,
            stock: item.product.stock,
            subtotal,
            imageUrl: item.product.images?.[0]?.url || "",
            meta: {
              adjusted: adjustedQuantity !== item.quantity,
              originalQuantity: item.quantity,
            },
          };
        });

      const cartCount = formattedCart.length;
      const cartTotal = formattedCart.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      console.log("🔒 Security event - Cart item deleted:", {
        userId: user.id,
        cartItemId: id,
        deletedItem: deletedItemInfo,
        remainingItems: cartCount,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      });

      return NextResponse.json(
        {
          success: true,
          message: "Item removed from cart successfully",
          data: {
            cartCount,
            cartTotal,
            cart: formattedCart,
            deletedItem: {
              id,
              productName: deletedItemInfo.productName,
              quantity: deletedItemInfo.quantity,
            },
            meta: {
              hasAdjustments: formattedCart.some((item) => item.meta?.adjusted),
              timestamp: new Date().toISOString(),
            },
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Cart delete error:", error.message);

      const isAuthError =
        error.message?.includes("authentication") ||
        error.message === "Authentication required";

      if (
        error.name !== "CastError" &&
        error.name !== "ValidationError" &&
        !isAuthError
      ) {
        captureException(error, {
          tags: {
            component: "api",
            route: "v1/cart/[id]/DELETE",
            cartItemId: id,
          },
        });
      }

      let status = 500;
      let message = "Something went wrong";
      let code = "INTERNAL_ERROR";

      if (error.name === "CastError") {
        status = 400;
        message = "Invalid cart item ID format";
        code = "INVALID_ID_FORMAT";
      } else if (error.name === "ValidationError") {
        status = 400;
        message = "Validation error";
        code = "VALIDATION_ERROR";
      } else if (isAuthError) {
        status = 401;
        message = "Authentication failed";
        code = "AUTH_FAILED";
      } else if (error.message?.includes("connection")) {
        status = 503;
        message = "Database connection error";
        code = "DB_CONNECTION_ERROR";
      }

      return NextResponse.json(
        {
          success: false,
          message,
          code,
          ...(process.env.NODE_ENV === "development" && {
            error: error.message,
          }),
        },
        { status },
      );
    }
  },
  {
    action: "remove", // 50 req/min, pas de blocage
    extractUserInfo: extractUserInfoFromRequest,
  },
);

/**
 * GET /api/v1/cart/[id]
 * Version mobile : récupère un élément spécifique du panier.
 * Rate limit: authenticatedRead (200 req/min)
 */
export const GET = withIntelligentRateLimit(
  async function (req, context) {
    let id;
    try {
      // Next.js 15 : params est une Promise dans les route handlers
      ({ id } = await context.params);

      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid cart item ID format",
            code: "INVALID_ID",
          },
          { status: 400 },
        );
      }

      const user = await isAuthenticatedUser();

      await dbConnect();

      const cartItem = await Cart.findOne({
        _id: id,
        user: user.id,
      })
        .populate("product", "name price stock images isActive description")
        .lean();

      if (!cartItem) {
        return NextResponse.json(
          {
            success: false,
            message: "Cart item not found",
            code: "CART_ITEM_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (!cartItem.product || !cartItem.product.isActive) {
        return NextResponse.json(
          {
            success: false,
            message: "Product no longer available",
            code: "PRODUCT_UNAVAILABLE",
          },
          { status: 410 },
        );
      }

      const adjustedQuantity = Math.min(
        cartItem.quantity,
        cartItem.product.stock,
      );
      const formattedItem = {
        id: cartItem._id,
        productId: cartItem.product._id,
        productName: cartItem.product.name,
        productDescription: cartItem.product.description,
        price: cartItem.product.price,
        quantity: adjustedQuantity,
        stock: cartItem.product.stock,
        subtotal: adjustedQuantity * cartItem.product.price,
        images: cartItem.product.images || [],
        meta: {
          adjusted: adjustedQuantity !== cartItem.quantity,
          originalQuantity: cartItem.quantity,
          inStock: cartItem.product.stock > 0,
          lowStock: cartItem.product.stock > 0 && cartItem.product.stock <= 5,
        },
      };

      return NextResponse.json(
        {
          success: true,
          data: {
            cartItem: formattedItem,
            meta: {
              timestamp: new Date().toISOString(),
            },
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Cart GET item error:", error.message);

      const isAuthError =
        error.message?.includes("authentication") ||
        error.message === "Authentication required";

      if (error.name !== "CastError" && !isAuthError) {
        captureException(error, {
          tags: {
            component: "api",
            route: "v1/cart/[id]/GET",
            cartItemId: id,
          },
        });
      }

      let status = 500;
      let message = "Failed to fetch cart item";
      let code = "INTERNAL_ERROR";

      if (isAuthError) {
        status = 401;
        message = "Authentication failed";
        code = "AUTH_FAILED";
      } else if (error.name === "CastError") {
        status = 400;
        message = "Invalid cart item ID format";
        code = "INVALID_ID_FORMAT";
      }

      return NextResponse.json({ success: false, message, code }, { status });
    }
  },
  {
    category: "api",
    action: "authenticatedRead",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
