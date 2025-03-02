const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const paymentEventHandler = require('./paymentEventHandler');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Create SQS consumer for payment requests
const createPaymentConsumer = () => {
  const consumer = Consumer.create({
    queueUrl: process.env.PAYMENT_QUEUE_URL,
    handleMessage: async (message) => {
      try {
        const event = JSON.parse(message.Body);
        await paymentEventHandler.handlePaymentRequest(event);
      } catch (error) {
        console.error('Error processing payment message:', error);
        // Don't throw - SQS will retry if we throw
      }
    },
    sqs: new AWS.SQS()
  });

  consumer.on('error', (err) => {
    console.error('SQS consumer error:', err.message);
  });

  consumer.on('processing_error', (err) => {
    console.error('SQS processing error:', err.message);
  });

  return consumer;
};

module.exports = { createPaymentConsumer }; 