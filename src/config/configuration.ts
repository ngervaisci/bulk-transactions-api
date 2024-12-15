export default () => ({
  transactions: {
    batchSize: parseInt(process.env.TRANSACTION_BATCH_SIZE ?? '100', 10) || 100,
  },
});
