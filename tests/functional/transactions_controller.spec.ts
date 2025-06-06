import { test } from '@japa/runner'
import Database from '@ioc:Adonis/Lucid/Database'
import { Application } from '@adonisjs/core/build/standalone'
import { exec } from 'node:child_process'
import { userPaymentType } from 'App/helpers/types'

test.group('Transactions controller (Integration)', (group) => {
  let app

  group.setup(async () => {
    // await Database.beginGlobalTransaction()

    // Create and boot application
    app = new Application(process.cwd(), 'test')
    await app.setup()
    await app.registerProviders()
    await app.bootProviders()

    // Run migrations using exec
    await new Promise((resolve, reject) => {
      exec('node ace migration:run && node ace db:seed --connection=pg', (error, stdout, stderr) => {
        if (error) {
          console.error('Migration error:', error)
          reject(error)
        } else {
          // console.log('Migration output:', stdout)
          resolve(stdout)
        }
      })
    })
  })

  group.teardown(async () => {
    // await Database.rollbackGlobalTransaction()
    await Database.manager.closeAll()
    await app.shutdown()
  })

  test('signup: successfully creates a new user', async ({ client, assert }) => {
    // Arrange: Create test data
    const userDetails = {
      email: 'test@example.com',
      password: 'password123',
      password_confirmation: 'password123',
    };

    // Act: Make HTTP request to the endpoint
    const response = await client.post('/user/account/signup').json(userDetails);

    // Assert: Check if the response status is 200
    assert.equal(response.status(), 200);
  });

  test('AddBank: successfully logs in and adds a bank account', async ({ client, assert }) => {
    // Arrange: Create test data
    const userDetails = {
      email: 'test@example.com',
      password: 'password123',
    };

    // Act: Make HTTP request to the endpoint
    const loginResponse = await client.post('/user/account/login').json(userDetails);
    const token = loginResponse.body().data.token;


    const bank = await client.get('/user/fiat-account/supported-banks').header('Authorization', `Bearer ${token}`)
      .then(response => response.body().data.filter(bank => bank.bank_name.includes('Zenith')));


    const bankResponse = await client
      .post('/user/fiat-account')
      .header('Authorization', `Bearer ${token}`)
      .json({
        accountName: 'okorie ebube',
        accountNo: '2260573513',
        bankId: String(bank[0].unique_id)
      })

    // Assert: Check if the response status is 200
    assert.equal(bankResponse.status(), 200);
  });


  test('createOfframpCrypto: successfully creates a sell transaction', async ({ client, assert }) => {

    const userDetails = {
      email: 'test@example.com',
      password: 'password123',
    };
    // Login to get auth token
    const loginResponse = await client.post('/user/account/login').json({
      email: userDetails.email,
      password: userDetails.password,
    });

    const token = loginResponse.body().data.token

    const currencies = await client.get('/user/currency/view').header('Authorization', `Bearer ${token}`)
    const senderCurrency = currencies.body().data.find(currency => currency.symbol === 'USDT')
    const receiverCurrency = currencies.body().data.find(currency => currency.symbol === 'NGN')


    const bank = await client.get('/user/fiat-account/supported-banks').header('Authorization', `Bearer ${token}`)
      .then(response => response.body().data.filter(bank => bank.bank_name.includes('Zenith')));

    await client
      .post('/user/fiat-account')
      .header('Authorization', `Bearer ${token}`)
      .json({
        accountName: 'okorie ebube',
        accountNo: '2260573513',
        bankId: String(bank[0].unique_id)
      })


    // Act: request to validate sell crypto request
    const validateResponse = await client
      .post('/user/transaction/offramp-crypto/validate')
      .header('Authorization', `Bearer ${token}`)
      .json({
        amountType: 'sending',
        amountInUsd: 1000,
        senderCurrencyId: String(senderCurrency.unique_id),
        recieverCurrencyId: String(receiverCurrency.unique_id),
      })

    assert.equal(validateResponse.body().message, 'Request successfull.')


    // Act: Make HTTP request to the endpoint
    const response = await client
      .post('/user/transaction/offramp-crypto/create')
      .header('Authorization', `Bearer ${token}`)
      .json({
        amountInUsd: 1000,
        senderCurrencyId: String(senderCurrency.unique_id),
        recieverCurrencyId: String(receiverCurrency.unique_id),
      })

    // Assert
    assert.equal(response.status(), 200)
    assert.equal(response.body().data, 'Sell Crypto Order, created.')
    assert.equal(response.body().error, false)
    assert.equal(response.body().result.amount_in_usd, 1000)
    assert.equal(response.body().result.status, 'TRANSACTION_CREATED')
  })

  test('createBuyCrypto: successfully creates a buy transaction', async ({ client, assert }) => {
    // Arrange: Create test data
    const userDetails = {
      email: 'test@example.com',
      password: 'password123',
      password_confirmation: 'password123',
    };

    // Login to get auth token
    const loginResponse = await client.post('/user/account/login').json({
      email: userDetails.email,
      password: userDetails.password,
    });

    const token = loginResponse.body().data.token

    const currencies = await client.get('/user/currency/view').header('Authorization', `Bearer ${token}`)
    const senderCurrency = currencies.body().data.find(currency => currency.symbol === 'NGN')
    const receiverCurrency = currencies.body().data.find(currency => currency.symbol === 'USDT')

    // Act: Make HTTP request to the validate endpoint
    const response = await client
      .post('/user/transaction/buy-crypto/validate')
      .header('Authorization', `Bearer ${token}`)
      .json({
        amountType: 'sending',
        amountInUsd: 1000,
        senderCurrencyId: String(senderCurrency.unique_id),
        recieverCurrencyId: String(receiverCurrency.unique_id),
      })

    // Assert
    assert.equal(response.status(), 200)
    assert.equal(response.body().message, 'Request successfull.')
    assert.exists(response.body().data)
    assert.isArray(response.body().data)
    assert.properties(response.body().data[0], [
      'sendingCurrencyUsdRate',
      'recievingCurrencyUsdRate',
      'fee',
      'actual_amount_user_sends',
    ])

    // Act: buy crypto with debit card
    const buyResponse = await client
      .post('user/transaction/buy-crypto/create')
      .header('Authorization', `Bearer ${token}`)
      .json({
        paymentType: userPaymentType.BANK_TRANSFER,
        amountInUsd: 1000,
        senderCurrencyId: String(senderCurrency.unique_id),
        recieverCurrencyId: String(receiverCurrency.unique_id),
        recievingWalletAddress: '0x10B3fA7Fc49e45CAe6d32A113731A917C4F1755a'
      })

    // Assert
    assert.equal(buyResponse.status(), 200)
    assert.equal(buyResponse.body().data, 'Buy Crypto Order, created.')
    assert.exists(buyResponse.body().result)
    assert.properties(buyResponse.body().result, [
      'id',
      'amount_in_usd',
      'status',
      'type',
    ])


  })


})
