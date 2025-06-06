import { test } from '@japa/runner'
import Database from '@ioc:Adonis/Lucid/Database'
import { Application } from '@adonisjs/core/build/standalone'
import Paystack from 'App/lib/fiat-provider/Paystack'
import { genRandomUuid } from 'App/helpers/utils'
import { transactionStatus } from 'App/helpers/types'
import { transactionType } from 'App/helpers/types'
import Transaction from 'App/models/Transaction'
import sinon from 'sinon'
import { createHmac } from 'crypto'
import TransactionsController from 'App/controllers/http/TransactionsController'
import SystemWallet from 'App/lib/system-wallet/SystemWallet'
import WebSocketsController from 'App/controllers/http/WebSocketsController'
import { ReadableStream } from 'stream/web'

test.group('Paystack Integration Tests', (group) => {
  let app: Application
  let paystack: Paystack

  // Setup: Initialize application and database
  group.setup(async () => {
    app = new Application(process.cwd(), 'test')
    await app.setup()
    await app.registerProviders()
    await app.bootProviders()

    paystack = new Paystack()
  })

  // Teardown: Clean up database and application
  group.teardown(async () => {
    await Database.manager.closeAll()
    await app.shutdown()
  })

    test('generateBankAccount: successfully generates a virtual bank account', async ({ assert }) => {

      const result = await paystack.generateBankAccount(
        'test-tx-ref-' + genRandomUuid(),
        '1000',
        'test@example.com'
      )
      // console.log({result})

      // Assert: Verify response
      assert.isString(result.accountNumber)
      assert.equal(result.bankName, 'Test Bank')
    })

    test('initSendBankTransfer: successfully initiates a bank transfer', async ({ assert }) => {
      const params = {
        accountNumber: '2260573513',
        amount: 1000,
        userEmail: 'test@example.com',
        bankCode: '057', // zenith bank
        txRef: 'test-tx-ref-' + genRandomUuid(),
      }
      const result = await paystack.initSendBankTransfer(params)

      // Assert: Verify response
      assert.isObject(result)
      assert.equal(result.data.status, 200)
      assert.equal(result.data.data.data.status, 'success')
    })

  test('verifyPayment: successfully verifies a payment', async ({ assert }) => {
    const reference = 'd46b0dcc-b4d8-473e-907f-c603115d8298'
    const result = await paystack.verifyPayment(reference)

    // Assert: Verify response (assuming reference may not exist in test mode)
    assert.isObject(result)
    assert.isBoolean(result.success)
    assert.isBoolean(result.transactionFound)
    assert.equal(result.data.status, 'success')
  })





})

// test.group('PaystackController Webhook Tests', (group) => {
//   let app: Application
//   let paystackController: Paystack
//   let mockTransaction: any
//   let mockCurrency: any

//   group.setup(async () => {
//     app = new Application(process.cwd(), 'test')
//     await app.setup()
//     await app.registerProviders()
//     await app.bootProviders()

//     paystackController = new Paystack()

//     // Mock transaction data
//     mockTransaction = {
//       uniqueId: 'test-txn-' + genRandomUuid(),
//       fiatProviderTxRef: 'paystack-ref-' + genRandomUuid(),
//       status: transactionStatus.TRANSACTION_CREATED,
//       type: transactionType.BUY_CRYPTO,
//       amountInUsd: 100,
//       recievingWalletAddress: '0x123abc456def',
//       recieverCurrencyId: 'currency-123',
//       userId: 'user-123'
//     }

//     mockCurrency = {
//       uniqueId: 'currency-123',
//       name: 'USDT',
//       network: 'bsc',
//       tokenAddress: '0x55d398326f99059fF775485246999027B3197955',
//       type: 'crypto'
//     }
//   })

//   group.teardown(async () => {
//     sinon.restore()
//     await Database.manager.closeAll()
//     await app.shutdown()
//   })

//   test('processWebhook: handles successful buy crypto webhook', async ({ assert }) => {
//     const payload = {
//       event: 'charge.success',
//       data: {
//         reference: mockTransaction.fiatProviderTxRef,
//         status: 'success',
//         amount: 10000, // in kobo
//         currency: 'NGN'
//       }
//     }

//     const secretKey = 'test-secret-key'
//     const signature = createHmac('sha512', secretKey)
//       .update(JSON.stringify(payload))
//       .digest('hex')

//     // Mock HTTP context
//     const mockRequest: Partial<Request> = {
//       body: new ReadableStream({
//         start(controller) {
//           controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)));
//           controller.close();
//         }
//       }),
//       headers: new Headers({ // Change this line
//         'x-paystack-signature': signature
//       })
//     }

//     const mockResponse = {
//       status: sinon.stub().returnsThis(),
//       send: sinon.stub()
//     }

//     // Mock database queries
//     const transactionQuery = sinon.stub(Transaction, 'query')
//     const mockQueryBuilder = {
//       preload: sinon.stub().returnsThis(),
//       where: sinon.stub().returnsThis(),
//     }

//     // First call - find transaction
//     transactionQuery.onFirstCall().returns({
//       ...mockQueryBuilder,
//       then: sinon.stub().resolves([{
//         ...mockTransaction,
//         recieverCurrency: mockCurrency
//       }])
//     })

//     // Second call - update transaction
//     const updateStub = sinon.stub().resolves()
//     transactionQuery.onSecondCall().returns({
//       where: sinon.stub().returnsThis(),
//       update: updateStub
//     })

//     // Mock external service calls
//     sinon.stub(paystackController, 'verifyPayment').resolves({
//       success: true,
//       data: {
//         amount: 10000,
//         currency: 'NGN'
//       }
//     })

//     sinon.stub(TransactionsController.prototype, '_calcActualAmountUserSends').returns(100)
//     sinon.stub(TransactionsController.prototype, '_calcActualAmountUserRecieves').returns(95)

//     const systemWalletStub = sinon.stub(SystemWallet.prototype, 'transferToken').resolves()
//     const webSocketStub = sinon.stub(WebSocketsController.prototype, 'emitStatusUpdateToClient').resolves()

//     // Mock startIndexerProcess function
//     const startIndexerStub = sinon.stub().returns(undefined)
//     global.startIndexerProcess = startIndexerStub

//     // Set secret key for controller
//     // paystackController.secretKey = secretKey

//     console.log('mockRequest', mockRequest)

//     // Execute webhook processing
//     await paystackController.processWebhook({
//       // @ts-ignore
//       request: ()=>mockRequest,
//       // @ts-ignore
//       response: mockResponse
//     })

//     console.log('mockResponse', mockResponse)

//     // Assertions
//     assert.isTrue(mockResponse.status.calledWith(200))
//     assert.isTrue(mockResponse.send.calledWith('Webhook processed.'))
//     assert.isTrue(updateStub.called)
//     assert.isTrue(systemWalletStub.called)
//     assert.isTrue(webSocketStub.called)
//     assert.isTrue(startIndexerStub.called)
//   })

// })
