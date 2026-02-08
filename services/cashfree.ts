// const axios = require('axios');
// const cashfree = require('../config/cashfree');
// const crypto = require('crypto');
// const mongoose = require('mongoose');
// const PaymentMethod = require('../models/PaymentMethod');
// const Payment = require('../models/Payment');
// const Transaction = require('../models/Transaction');
// const generateOrderId = () => {
//   return `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
// };

// const initiatePayment = async (orderData) => {
//   try {
//     const {
//       order_id,
//       order_amount,
//       order_currency = 'INR',
//       customer_details,
//       order_meta,
//       order_note
//     } = orderData;

//     if (!order_id || !order_amount || !customer_details) {
//       throw new Error('Missing required order fields');
//     }

//     console.log(`Creating Cashfree order for ${order_amount} ${order_currency}, order ID: ${order_id}`);
    
//     const response = await axios.post(
//       `${process.env.CASHFREE_BASE_URL}/orders`,
//       orderData,
//       {
//         headers: {
//           'x-api-version': process.env.CASHFREE_API_VERSION || '2022-09-01',
//           'Content-Type': 'application/json',
//           'x-client-id': process.env.CASHFREE_APP_ID,
//           'x-client-secret': process.env.CASHFREE_SECRET_KEY,
//           'Accept': 'application/json'
//         }
//       }
//     );

//     console.log(`Cashfree order created: ${response.data.cf_order_id}`);

//     return {
//       success: true,
//       orderId: response.data.cf_order_id,
//       paymentSessionId: response.data.payment_session_id,
//       paymentLink: response.data.payment_link,
//       amount: order_amount,
//       currency: order_currency,
//       gatewayResponse: response.data
//     };
//   } catch (error) {
//     console.error("Error creating order on Cashfree:", error);
//     return {
//       success: false,
//       error: error.response?.data?.message || error.message,
//       gatewayResponse: error.response?.data
//     };
//   }
// };
// class CashfreeService {
  
//   static async createPayment(paymentData) {
//       try {
//         console.log("Request body:", paymentData);
//         const {
//           payment_purpose,      // "Investment" or "Subscription"
//           payment_amount,
//           payment_currency = 'INR',
//           payee_ref,
//           payee_type,
//           receiver_ref,
//           receiver_type,
//           customer_name,
//           customer_email,
//           customer_phone,
//           description,
//           return_url,           // e.g., https://investment.nucleohq.com/payment-status?order_id={order_id}
//           notify_url,           // e.g., https://api.nucleohq.com/api/v1/payment/webhook,        // "Debit Card", "upi", "net_banking", etc.
//           payment_details,      // Object with method-specific details
//           isSubscription,       // boolean flag
//           subscriptionType      // e.g., "monthly", "yearly", "auto-debit", "one-time"
//         } = paymentData;
//         const userId =  "65f123456789abcdef123456";
    
//         // Validate required fields
//         if (!payment_purpose || !payment_amount || !payee_ref || !payee_type ||
//             !receiver_ref || !receiver_type || !customer_email || !customer_phone ) {
//           // console.log("Missing required fields:", req.body);
//           return { success: false, message: 'Missing required fields' }; // Return an object instead of res.json
//         }
//         let paymentMethod ="";
//         // Payment method–specific validations
//         if (paymentMethod === "Debit Card") {
//           if (!payment_details?.card_number || !payment_details?.expiry || !payment_details?.cvv) {
//             // return res.status(400).json({ success: false, message: "Debit Card details are required" });
//             return { success: false, message: "Debit Card details are required" };
//           }
//         } else if (paymentMethod === "upi") {
//           if (!payment_details?.upi_id) {
//             // return res.status(400).json({ success: false, message: "UPI ID is required" });
//             return { success: false, message: "UPI ID is required" };
//           }
//         } else if (paymentMethod === "net_banking") {
//           if (!payment_details?.bank_code) {
//             // return res.status(400).json({ success: false, message: "Bank code is required" });
//             return { success: false, message: "Bank code is required" };
//           }
//         }
//         else{
//           console.log("Payment method not defined yet");
//         }
    
    
//         // Create a Payment record (using MongoDB _id as  order id for Cashfree)
//         const orderId = generateOrderId();
//         const PaymentModel = Payment;
//         const paymentRecord = new PaymentModel({
//           request_ref: orderId,
//           payment_purpose,
//           payment_amount,
//           payment_currency,
//           payee_ref: new mongoose.Types.ObjectId(payee_ref),
//           payee_type,
//           receiver_ref: new mongoose.Types.ObjectId(receiver_ref),
//           receiver_type,
//           payment_gateway: 'CASHFREE',
//           payment_status: 'PENDING',
//           created_by: new mongoose.Types.ObjectId(userId),
//           updated_by: new mongoose.Types.ObjectId(userId)
//         });
//         await paymentRecord.save();
    
//         // Build payload for Cashfree order creation
//         const payload = {
//           order_id: paymentRecord._id.toString(), // Use DB _id as order id in gateway payload
//           order_amount: payment_amount,
//           order_currency: payment_currency,
//           customer_details: {
//             customer_id: userId,
//             customer_name: customer_name || 'Customer',
//             customer_email,
//             customer_phone
//           },
//           order_meta: { return_url, notify_url },
//           order_note: description || `Payment for ${payment_purpose}`,
//           payment_method: paymentMethod,
//           payment_details: payment_details || {}
//         };
    
//         // Call Cashfree API through your handler
//         const result = await initiatePayment(payload);
//         if (!result.success) {
//           await PaymentModel.findByIdAndUpdate(paymentRecord._id, {
//             payment_status: 'FAILED',
//             updated_by: new mongoose.Types.ObjectId(userId)
//           });
//           return res.status(400).json({ success: false, message: result.error, error: result.gatewayResponse });
//         }
    
//         // Create a Transaction record
//         const TransactionModel = Transaction;
//         const transactionRecord = new TransactionModel({
//           transaction_mode: 'PENDING', // Will be updated in webhook
//           payment_id: paymentRecord._id,
//           gateway_used: 'CASHFREE',
//           gateway_response: result.gatewayResponse,
//           created_by: new mongoose.Types.ObjectId(userId),
//           updated_by: new mongoose.Types.ObjectId(userId)
//         });
//         await transactionRecord.save();
    
//         // Link the Transaction record to Payment record
//         await PaymentModel.findByIdAndUpdate(paymentRecord._id, {
//           transaction: transactionRecord._id,
//           updated_by: new mongoose.Types.ObjectId(userId)
//         });
    
//         // Save tokenized payment method details (if Debit Card and token exists)
//         if (paymentMethod === "Debit Card" && result.gatewayResponse && result.gatewayResponse.token_id) {
//           const existingToken = await PaymentMethod.findOne({ user_id: userId, card_token: result.gatewayResponse.token_id });
//           if (!existingToken) {
//             const paymentMethodRecord = new PaymentMethod({
//               user_id: new mongoose.Types.ObjectId(userId),
//               method_type: "CARD",
//               card_token: result.gatewayResponse.token_id,
//               card_network: result.gatewayResponse.card_network || "UNKNOWN",
//               card_type: result.gatewayResponse.card_type || "DEBIT",
//               card_last4: result.gatewayResponse.card_last4 || "0000",
//               card_expiry: result.gatewayResponse.card_expiry || "00/00",
//               is_default: false
//             });
//             await paymentMethodRecord.save();
//           }
//         }
    
//         // If subscription, and subscriptionType is not "one-time", then call Cashfree Subscription API
//         if (isSubscription && subscriptionType && subscriptionType !== "one-time") {
//           try {
//             const subscriptionPayload = {
//               order_id: paymentRecord._id.toString(),
//               plan_id: process.env.CASHFREE_SUBSCRIPTION_PLAN_ID, // Pre-configured plan in Cashfree dashboard
//               subscription_amount: payment_amount,
//               subscription_currency: payment_currency,
//               customer_details: {
//                 customer_id: userId,
//                 customer_name: customer_name || 'Customer',
//                 customer_email,
//                 customer_phone
//               },
//               order_meta: { return_url, notify_url },
//               order_note: description || `Subscription Payment for ${payment_purpose}`,
//               subscription_type: subscriptionType // e.g., "monthly", "yearly", "auto-debit"
//             };
    
//             const subResult = await axios.post(
//               process.env.CASHFREE_BASE_URL + '/subscriptions?api_version=' + API_VERSION,
//               subscriptionPayload,
//               {
//                 headers: {
//                   'x-api-version': API_VERSION,
//                   'Content-Type': 'application/json',
//                   'x-client-id': process.env.CASHFREE_APP_ID,
//                   'x-client-secret': process.env.CASHFREE_SECRET_KEY,
//                   Accept: 'application/json'
//                 }
//               }
//             );
//             console.log("Subscription API response:", subResult.data);
//             await PaymentModel.findByIdAndUpdate(paymentRecord._id, {
//               subscription_id: subResult.data.subscription_id,
//               subscription_status: subResult.data.status,
//               updated_by: new mongoose.Types.ObjectId(userId)
//             });
//           } catch (subError) {
//             console.error("Recurring mandate setup error:", subError.response ? subError.response.data : subError.message);
//             // Optionally update paymentRecord to flag subscription mandate setup failure.
//           }
//         }
    
//         // return res.status(200).json({
//         //   success: true,
//         //   payment_id: paymentRecord._id,
//         //   order_id: orderId,
//         //   payment_session_id: result.paymentSessionId,
//         //   payment_link: result.paymentLink
//         // });
//         return {
//           success: true,
//           payment_id: paymentRecord._id,
//           order_id: orderId,
//           payment_session_id: result.paymentSessionId,
//           payment_link: result.paymentLink
//         };
//       } catch (error) {
//         console.error('Payment creation error:', error);
//         // return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
//         return { success: false, message: 'Internal server error', error: error.message };

//       }
    
//   }

//   static verifyWebhookSignature(payload, signature) {
//     try {
//       if (!signature) {
//         console.error('Cashfree webhook signature is missing');
//         return false;
//       }

//       const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
//       if (!webhookSecret) {
//         console.error('Cashfree webhook secret is not configured');
//         return false;
//       }

//       // If payload is an object, stringify it
//       const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
//       // Create HMAC SHA256 hash
//       const crypto = require('crypto');
//       const computedSignature = crypto
//         .createHmac('sha256', webhookSecret)
//         .update(body)
//         .digest('hex');
      
//       // Compare signatures
//       return computedSignature === signature;
//     } catch (error) {
//       console.error('Error verifying Cashfree webhook signature:', error);
//       return false;
//     }
//   }

//   static processWebhookData(payload) {
//     try {
//       const eventType = payload.event || null;
      
//       // Handle subscription events
//       if (eventType === 'SUBSCRIPTION_ACTIVATED' || 
//           eventType === 'SUBSCRIPTION_CANCELLED' || 
//           eventType === 'SUBSCRIPTION_PAUSED') {
//         return {
//           event: eventType.toLowerCase().replace('_', '.'),
//           subscription_id: payload.data?.subscriptionId || null,
//           payment_id: payload.data?.cfPaymentId || null,
//           status: payload.data?.status || null
//         };
//       }
      
//       // Handle payment events
//       else if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || 
//                eventType === 'PAYMENT_FAILED_WEBHOOK') {
//         return {
//           event: eventType === 'PAYMENT_SUCCESS_WEBHOOK' ? 'payment.success' : 'payment.failed',
//           payment_id: payload.data?.payment?.cfPaymentId || null,
//           order_id: payload.data?.order?.orderId || null,
//           status: eventType === 'PAYMENT_SUCCESS_WEBHOOK' ? 'success' : 'failed'
//         };
//       }
      
//       return {
//         event: eventType,
//         status: null
//       };
//     } catch (error) {
//       console.error('Error processing Cashfree webhook data:', error);
//       return null;
//     }
//   }
// }

// module.exports = CashfreeService;
