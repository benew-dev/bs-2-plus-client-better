import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import Order from "@/backend/models/order";
import Product from "@/backend/models/product";
import Category from "@/backend/models/category";
import Cart from "@/backend/models/cart";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  isAuthenticatedUser,
  extractUserInfoFromRequest,
} from "@/lib/auth-utils";
import { ObjectId } from "mongodb";

export const POST = withIntelligentRateLimit(
  async function (req) {
    try {
      // 1. Authentification (Better Auth)
      const authUser = await isAuthenticatedUser();

      // 2. Connexion DB — collection native Better Auth ("user", pas le modèle Mongoose)
      const mongooseInstance = await dbConnect();
      const db = mongooseInstance.connection.getClient().db();

      const user = await db.collection("user").findOne(
        { _id: new ObjectId(authUser.id) },
        {
          projection: {
            name: 1,
            email: 1,
            phone: 1,
            avatar: 1,
            address: 1,
            isActive: 1,
          },
        },
      );

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      // Vérifier si le compte est actif
      if (!user.isActive) {
        console.warn("Inactive user attempting to place order:", user.email);
        return NextResponse.json(
          {
            success: false,
            message: "Account suspended. Cannot place orders",
            code: "ACCOUNT_SUSPENDED",
          },
          { status: 403 },
        );
      }

      // 4. Parser et valider les données de commande
      let orderData;
      try {
        orderData = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid request body",
            code: "INVALID_BODY",
          },
          { status: 400 },
        );
      }

      // Validation basique des champs requis
      if (!orderData?.orderItems?.length) {
        return NextResponse.json(
          {
            success: false,
            message: "Order must contain at least one item",
            code: "EMPTY_ORDER",
          },
          { status: 400 },
        );
      }

      if (!orderData.paymentInfo) {
        return NextResponse.json(
          {
            success: false,
            message: "Payment information is required",
            code: "MISSING_PAYMENT_INFO",
          },
          { status: 400 },
        );
      }

      // Validation du paiement
      const { typePayment, paymentAccountNumber, paymentAccountName } =
        orderData.paymentInfo || {};

      if (!typePayment) {
        return NextResponse.json(
          {
            success: false,
            message: "Type de paiement requis",
            code: "MISSING_PAYMENT_TYPE",
          },
          { status: 400 },
        );
      }

      if (typePayment !== "CASH") {
        if (!paymentAccountNumber || !paymentAccountName) {
          return NextResponse.json(
            {
              success: false,
              message: "Informations de compte incomplètes",
              code: "INCOMPLETE_PAYMENT_INFO",
            },
            { status: 400 },
          );
        }
      } else {
        orderData.paymentInfo.paymentAccountNumber = "N/A";
        orderData.paymentInfo.paymentAccountName = "Paiement en espèces";
        orderData.paymentInfo.isCashPayment = true;
        orderData.paymentInfo.cashPaymentNote =
          "Le paiement sera effectué en espèces à la livraison";
      }

      // 5. Vérifier le stock et traiter la commande en transaction
      const session = await Order.startSession();

      try {
        await session.withTransaction(async () => {
          const productOrders = orderData.orderItems.map((item) => ({
            productId: item.product,
            quantity: parseInt(item.quantity, 10),
            cartId: item.cartId,
            price: parseFloat(item.price),
          }));

          const unavailableProducts = [];
          const processedItems = [];

          for (const item of productOrders) {
            const product = await Product.findById(item.productId)
              .select("name stock price category isActive")
              .populate("category", "categoryName")
              .session(session);

            if (!product) {
              unavailableProducts.push({
                id: item.productId,
                name: "Product not found",
                reason: "not_found",
              });
              continue;
            }

            if (!product.isActive) {
              unavailableProducts.push({
                id: product._id,
                name: product.name,
                reason: "product_inactive",
              });
              continue;
            }

            if (product.stock < item.quantity) {
              unavailableProducts.push({
                id: product._id,
                name: product.name,
                stock: product.stock,
                requested: item.quantity,
                reason: "insufficient_stock",
              });
              continue;
            }

            if (Math.abs(product.price - item.price) > 0.01) {
              console.warn("Price mismatch detected:", {
                productId: product._id,
                expectedPrice: product.price,
                providedPrice: item.price,
                userId: authUser.id,
              });

              unavailableProducts.push({
                id: product._id,
                name: product.name,
                reason: "price_mismatch",
                expected: product.price,
                provided: item.price,
              });
              continue;
            }

            await Product.findByIdAndUpdate(
              product._id,
              {
                $inc: {
                  stock: -item.quantity,
                  sold: item.quantity,
                },
              },
              { session },
            );

            const orderItem = orderData.orderItems.find(
              (oi) => oi.product.toString() === product._id.toString(),
            );
            if (orderItem && product.category) {
              orderItem.category = product.category.categoryName;
            }

            processedItems.push({
              productId: product._id,
              productName: product.name,
              quantity: item.quantity,
              price: product.price,
            });
          }

          if (unavailableProducts.length > 0) {
            throw new Error(
              JSON.stringify({
                type: "STOCK_ERROR",
                products: unavailableProducts,
              }),
            );
          }

          orderData.orderItems.forEach((item) => {
            delete item.cartId;
          });

          // ✅ Construire l'objet utilisateur avec les données Better Auth
          orderData.user = {
            userId: authUser.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar?.url || null,
            address: {
              street: user.address?.street || null,
              city: user.address?.city || null,
              country: user.address?.country || null,
            },
          };

          const order = await Order.create([orderData], { session });

          const cartIds = productOrders
            .filter((item) => item.cartId)
            .map((item) => item.cartId);

          if (cartIds.length > 0) {
            const deleteResult = await Cart.deleteMany(
              { _id: { $in: cartIds }, user: authUser.id },
              { session },
            );

            console.log(
              `Cleared ${deleteResult.deletedCount} items from cart for user ${authUser.id}`,
            );
          }

          return order[0];
        });

        // Transaction réussie - Récupérer la commande complète
        const order = await Order.findOne({ "user.userId": authUser.id })
          .sort({ createdAt: -1 })
          .select("_id orderNumber totalAmount")
          .lean();

        // Log de sécurité pour audit
        console.log("🔒 Security event - Order created:", {
          userId: authUser.id,
          userEmail: user.email,
          orderId: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paymentType: typePayment,
          itemCount: orderData.orderItems.length,
          timestamp: new Date().toISOString(),
          ip:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "unknown",
        });

        return NextResponse.json(
          {
            success: true,
            id: order.orderNumber,
            orderNumber: order.orderNumber,
            message: "Order placed successfully",
          },
          { status: 201 },
        );
      } catch (transactionError) {
        if (transactionError.message?.includes("STOCK_ERROR")) {
          try {
            const errorData = JSON.parse(transactionError.message);

            console.warn("Order failed due to stock issues:", {
              userId: authUser.id,
              unavailableProducts: errorData.products,
              timestamp: new Date().toISOString(),
            });

            return NextResponse.json(
              {
                success: false,
                message: "Some products are unavailable",
                code: "STOCK_ERROR",
                unavailableProducts: errorData.products,
              },
              { status: 409 },
            );
          } catch {
            // Fallback si le parsing échoue
          }
        }

        console.error("Transaction failed:", {
          userId: authUser.id,
          error: transactionError.message,
          timestamp: new Date().toISOString(),
        });

        throw transactionError;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error("Order webhook error:", error.message);

      const isAuthError =
        error.message?.includes("authentication") ||
        error.message === "Authentication required";

      if (
        !isAuthError &&
        !error.message?.includes("STOCK_ERROR") &&
        !error.message?.includes("PAYMENT_")
      ) {
        captureException(error, {
          tags: {
            component: "api",
            route: "orders/webhook/POST",
            critical: true,
          },
          level: "error",
        });
      }

      let status = 500;
      let message = "Failed to process order. Please try again.";
      let code = "INTERNAL_ERROR";

      if (isAuthError) {
        status = 401;
        message = "Authentication failed";
        code = "AUTH_FAILED";
      } else if (error.message?.includes("MongoNetwork")) {
        status = 503;
        message = "Database connection error. Please try again";
        code = "DB_CONNECTION_ERROR";
      } else if (error.message?.includes("timeout")) {
        status = 504;
        message = "Request timeout. Please try again";
        code = "TIMEOUT";
      } else if (error.message?.includes("Transaction")) {
        status = 500;
        message = "Transaction failed. No charges were made";
        code = "TRANSACTION_FAILED";
      }

      return NextResponse.json(
        {
          success: false,
          message,
          code,
          ...(process.env.NODE_ENV === "development" && {
            error: error.message,
            stack: error.stack,
          }),
        },
        { status },
      );
    }
  },
  {
    category: "payment",
    action: "createOrder",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
