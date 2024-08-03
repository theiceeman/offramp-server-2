import Route from '@ioc:Adonis/Core/Route'
// import WebSocketsController from 'App/controllers/http/WebSocketsController'

// Route.get('/', async () => {
//   await new WebSocketsController()
//     .emitStatusUpdateToClient('07dc5962-dbcc-4871-8494-bc384749924a')
// })


Route.get('/app/global-configuration', 'AppConfigurationsController.admin').middleware('auth:admin')
Route.get('/app/user/global-configuration', 'AppConfigurationsController.user').middleware('auth:user')

Route.group(() => {
  Route.post('/login', 'AuthUserController.login')
  Route.post('/signup', 'AuthUserController.signup')
  Route.get('/view', 'AuthUserController.viewLoggedInUser').middleware('auth')
  Route.patch('/update', 'AuthUserController.updateLoggedInUser').middleware('auth')
}).prefix('/user/account')

Route.group(() => {
  Route.post('/offramp-crypto/validate', 'TransactionsController.validateOffRampCrypto')
  Route.post('/buy-crypto/validate', 'TransactionsController.validateBuyCrypto')
  Route.post('/offramp-crypto/create', 'TransactionsController.createOfframpCrypto')
  Route.post('/buy-crypto/create', 'TransactionsController.createBuyCrypto')
  Route.get('/view', 'TransactionsController.viewLoggedInUserTransactions')
  Route.get('/view/:id', 'TransactionsController.viewSingleTransaction')
}).prefix('/user/transaction').middleware('auth:user')

Route.group(() => {
  Route.post('/', 'FiatAccountController.create')
  Route.get('/', 'FiatAccountController.viewUsersAccounts')
  Route.delete('/:id', 'FiatAccountController.delete')
  Route.get('/supported-banks', 'FiatAccountController.supportedBanks')
}).prefix('/user/fiat-account').middleware('auth')

Route.group(() => {
  Route.get('/view', 'CurrencyController.viewCurrenciesAsUser')
}).prefix('/user/currency').middleware('auth:user')

Route.group(() => {
  Route.post('/create', 'TicketsController.createTicket')
  Route.post('/reply/:ticketId', 'TicketsController.replyTicket')
  Route.get('/single/:ticketId', 'TicketsController.viewConversation')
}).prefix('/user/ticket').middleware('auth:user')


Route.group(() => {
  Route.get('/view', 'SettingsController.viewSettingsUser')
}).prefix('/user/setting').middleware('auth:user')




Route.post('/admin/admin-account/login', 'AuthAdminController.login')
Route.get('/admin/system-overview', 'AppOverviewsController.view').middleware('auth:admin')

Route.group(() => {
  Route.post('/create', 'AuthAdminController.create')
  Route.get('/view', 'AuthAdminController.viewAllAdmins')
  Route.get('/view-loggedin', 'AuthAdminController.viewLoggedInAdmin')
  Route.patch('/block/:adminId', 'AuthAdminController.blockAdmin')
  Route.patch('/unblock/:adminId', 'AuthAdminController.unblockAdmin')
  Route.patch('/update', 'AuthAdminController.updateLoggedInAdmin')
}).prefix('/admin/admin-account').middleware('auth:admin')


Route.group(() => {
  Route.get('/view/:userId', 'FiatAccountController.viewUsersAccountAsAdmin')
}).prefix('/admin/user-fiat-account').middleware('auth:admin')


Route.group(() => {
  Route.patch('/processing', 'TransactionsController.setStatusProcessing')
  Route.patch('/complete', 'TransactionsController.setStatusComplete')
  Route.patch('/confirmed', 'TransactionsController.reverseStatusToConfirmed')
}).prefix('/admin/transaction/offramp-crypto').middleware('auth:admin')


Route.group(() => {
  Route.get('/view', 'TransactionsController.viewTransactions')
  Route.get('/view/:id', 'TransactionsController.viewSingleTransaction')
}).prefix('/admin/transaction').middleware('auth:admin')

Route.group(() => {
  Route.get('/view', 'AuthUserController.viewAllUsers')
  Route.get('/single/:userId', 'AuthUserController.viewSingleUser')
  Route.patch('/block/:userId', 'AuthUserController.blockUser')
  Route.patch('/unblock/:userId', 'AuthUserController.unblockUser')
}).prefix('/admin/user').middleware('auth:admin')

Route.group(() => {
  Route.post('/create', 'CurrencyController.createCurrency')
  Route.get('/view', 'CurrencyController.viewCurrenciesAsAdmin')
  Route.patch('/update/:currencyId', 'CurrencyController.update')
  Route.delete('/delete/:currencyId', 'CurrencyController.deleteCurrency')
}).prefix('/admin/currency').middleware('auth:admin')

Route.group(() => {
  Route.get('/address', 'SystemWalletController.viewAddress')
  Route.get('/native-coin-balances', 'SystemWalletController.viewNativeCoinBalance')
  Route.get('/currencies-balance', 'SystemWalletController.viewCurrenciesBalance')

  Route.post('/flush-tokens', 'SystemWalletController.flushTokens')
  Route.post('/withdraw-token', 'SystemWalletController.withdrawToken')
}).prefix('/admin/system-wallet').middleware('auth:admin')

Route.group(() => {
  Route.get('/view-total-balance', 'UserWalletsController.viewTotalCurrenciesBalance')
  Route.get('/view-user-balance/:userId', 'UserWalletsController.viewBalance')
}).prefix('/admin/users-wallet').middleware('auth:admin')

Route.group(() => {
  Route.get('/view', 'SettingsController.viewSettingsAdmin')
  Route.patch('/update', 'SettingsController.update')
}).prefix('/admin/setting').middleware('auth:admin')

Route.group(() => {
  Route.get('/view', 'TicketsController.viewTickets')
  Route.post('/reply/:ticketId', 'TicketsController.replyTicket')
  Route.get('/single/:ticketId', 'TicketsController.viewConversation')
  Route.patch('/close/:ticketId', 'TicketsController.closeTicket')
}).prefix('/admin/ticket').middleware('auth:admin')
