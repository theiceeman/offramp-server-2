import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Route from "@ioc:Adonis/Core/Route";
import { isTestNetwork } from "App/helpers/utils";
import Flutterwave from "App/lib/fiat-provider/Flutterwave";
import Paystack from "App/lib/fiat-provider/Paystack";
import Currency from "App/models/Currency";
import Transaction from "App/models/Transaction";

Route.get("/", async () => {
  try {
    let flutterwave = new Flutterwave("prod");
    let params = {
      accountBank: "some_bank",
      accountNumber: "some_account_number",
      amount: 10,
      txRef: "some_tx_ref",
    };
    let result = await flutterwave.initSendBankTransfer(params);
    console.log({ result });
  } catch (error) {
    console.error({ error });
  }
});

Route.get(
  "/app/global-configuration",
  "AppConfigurationsController.admin"
).middleware("auth:admin");
Route.get("/app/user/global-configuration", "AppConfigurationsController.user");

Route.group(() => {
  Route.post("/login", "AuthUserController.login");
  Route.post("/signup", "AuthUserController.signup");
  Route.get("/view", "AuthUserController.viewLoggedInUser").middleware("auth");
  Route.patch("/update", "AuthUserController.updateLoggedInUser").middleware(
    "auth"
  );
  Route.post("/logout", "AuthUserController.logout").middleware("auth");
}).prefix("/user/account");

Route.group(() => {
  Route.post(
    "/offramp-crypto/validate",
    "TransactionsController.validateOffRampCrypto"
  );
  Route.post(
    "/buy-crypto/validate",
    "TransactionsController.validateBuyCrypto"
  );
  Route.post(
    "/offramp-crypto/create",
    "TransactionsController.createOfframpCrypto"
  );
  Route.post("/buy-crypto/create", "TransactionsController.createBuyCrypto");
  Route.get("/view", "TransactionsController.viewLoggedInUserTransactions");
  Route.get("/view/:id", "TransactionsController.viewSingleTransaction");
})
  .prefix("/user/transaction")
  .middleware("auth:user");

Route.group(() => {
  Route.post("/", "FiatAccountController.create");
  Route.get("/", "FiatAccountController.viewUsersAccounts");
  Route.delete("/:id", "FiatAccountController.delete");
  Route.get("/supported-banks", "FiatAccountController.supportedBanks");
})
  .prefix("/user/fiat-account")
  .middleware("auth");

Route.group(() => {
  Route.get("/view", "CurrencyController.viewCurrenciesAsUser");
})
  .prefix("/user/currency")
  .middleware("auth:user");

Route.group(() => {
  Route.post("/create", "TicketsController.createTicket");
  Route.post("/reply/:ticketId", "TicketsController.replyTicket");
  Route.get("/single/:ticketId", "TicketsController.viewConversation");
})
  .prefix("/user/ticket")
  .middleware("auth:user");

Route.group(() => {
  Route.get("/view", "SettingsController.viewSettingsUser");
})
  .prefix("/user/setting")
  .middleware("auth:user");

Route.post("/admin/admin-account/login", "AuthAdminController.login");
Route.get("/admin/system-overview", "AppOverviewsController.view").middleware(
  "auth:admin"
);

Route.group(() => {
  Route.post("/create", "AuthAdminController.create");
  Route.get("/view", "AuthAdminController.viewAllAdmins");
  Route.get("/view-loggedin", "AuthAdminController.viewLoggedInAdmin");
  Route.patch("/block/:adminId", "AuthAdminController.blockAdmin");
  Route.patch("/unblock/:adminId", "AuthAdminController.unblockAdmin");
  Route.patch("/update", "AuthAdminController.updateLoggedInAdmin");
})
  .prefix("/admin/admin-account")
  .middleware("auth:admin");

Route.group(() => {
  Route.get("/view/:userId", "FiatAccountController.viewUsersAccountAsAdmin");
})
  .prefix("/admin/user-fiat-account")
  .middleware("auth:admin");

Route.group(() => {
  Route.patch("/processing", "TransactionsController.setStatusProcessing");
  Route.patch("/failed", "TransactionsController.setStatusFailed");
  Route.patch("/complete", "TransactionsController.setStatusComplete");
  Route.patch("/confirmed", "TransactionsController.reverseStatusToConfirmed");
})
  .prefix("/admin/transaction/offramp-crypto")
  .middleware("auth:admin");

Route.group(() => {
  Route.get("/view", "TransactionsController.viewTransactions");
  Route.get("/view/:id", "TransactionsController.viewSingleTransaction");
})
  .prefix("/admin/transaction")
  .middleware("auth:admin");

Route.group(() => {
  Route.get("/view", "AuthUserController.viewAllUsers");
  Route.get("/single/:userId", "AuthUserController.viewSingleUser");
  Route.patch("/block/:userId", "AuthUserController.blockUser");
  Route.patch("/unblock/:userId", "AuthUserController.unblockUser");
})
  .prefix("/admin/user")
  .middleware("auth:admin");

Route.group(() => {
  Route.post("/create", "CurrencyController.createCurrency");
  Route.get("/view", "CurrencyController.viewCurrenciesAsAdmin");
  Route.patch("/update/:currencyId", "CurrencyController.update");
  Route.delete("/delete/:currencyId", "CurrencyController.deleteCurrency");
})
  .prefix("/admin/currency")
  .middleware("auth:admin");

Route.group(() => {
  Route.get("/address", "SystemWalletController.viewAddress");
  Route.get(
    "/native-coin-balances",
    "SystemWalletController.viewNativeCoinBalance"
  );
  Route.get(
    "/currencies-balance",
    "SystemWalletController.viewCurrenciesBalance"
  );

  Route.post("/flush-tokens", "SystemWalletController.flushTokens");
  Route.post("/withdraw-token", "SystemWalletController.withdrawToken");
})
  .prefix("/admin/system-wallet")
  .middleware("auth:admin");

Route.group(() => {
  Route.get(
    "/view-total-balance",
    "UserWalletsController.viewTotalCurrenciesBalance"
  );
  Route.get("/view-user-balance/:userId", "UserWalletsController.viewBalance");
})
  .prefix("/admin/users-wallet")
  .middleware("auth:admin");

Route.group(() => {
  Route.get("/view", "SettingsController.viewSettingsAdmin");
  Route.patch("/update", "SettingsController.update");
})
  .prefix("/admin/setting")
  .middleware("auth:admin");

Route.group(() => {
  Route.get("/view", "TicketsController.viewTickets");
  Route.post("/reply/:ticketId", "TicketsController.replyTicket");
  Route.get("/single/:ticketId", "TicketsController.viewConversation");
  Route.patch("/close/:ticketId", "TicketsController.closeTicket");
})
  .prefix("/admin/ticket")
  .middleware("auth:admin");

Route.post(
  "transaction/flutterwave/process-web-hook",
  async (context: HttpContextContract) => {
    try {
      const payload = context.request.body();
      console.log("fwv payload", payload);
      let txn = await Transaction.query().where(
        "fiat_provider_tx_ref",
        payload?.data?.tx_ref
      );

      const recievingCurrency = await Currency.query().where(
        "unique_id",
        txn[0].recieverCurrencyId
      );

      let isTestTransaction = isTestNetwork(recievingCurrency[0].network);
      const message = await new Flutterwave(
        isTestTransaction ? "dev" : "prod"
      ).processWebhook(context);

      context.response.send(message);
    } catch (error) {
      console.error({ error });
    }
  }
);

Route.post(
  "transaction/payment-provider/process-web-hook",
  async (context: HttpContextContract) => {
    try {
      const payload = context.request.body();
      console.log("Received Webhook Payload:", payload);

      const reference =
        payload?.data?.reference ||
        payload?.data?.tx_ref ||
        payload?.data?.txref;
      const transactionId = payload?.data?.transactionId; // Your internal transaction ID

      if (!reference) {
        console.error("No transaction reference found in payload:", payload);
        return context.response.status(400).send({
          error: "No transaction reference found in payload",
        });
      }

      console.log("Looking for transaction with reference:", reference);

      // First, try to find by fiat_provider_tx_ref
      let txn = await Transaction.query()
        .where("fiat_provider_tx_ref", reference)
        .first();

      // If not found, try by uniqueId (internal transactionId) and update fiat_provider_tx_ref
      if (!txn && transactionId) {
        txn = await Transaction.query()
          .where("uniqueId", transactionId)
          .first();

        if (txn) {
          // Update the transaction with the Paystack reference
          txn.fiatProviderTxRef = reference;
          await txn.save();
          console.log(
            "Updated transaction with Paystack reference:",
            reference
          );
        }
      }

      if (!txn) {
        console.error(
          "Transaction not found for reference:",
          reference,
          "or transactionId:",
          transactionId
        );
        return context.response.status(404).send({
          error: "Transaction not found",
        });
      }

      const receivingCurrency = await Currency.query()
        .where("unique_id", txn.recieverCurrencyId)
        .first();

      if (!receivingCurrency) {
        console.error(
          "Receiving currency not found for transaction:",
          txn.uniqueId
        );
        return context.response.status(404).send({
          error: "Receiving currency not found",
        });
      }

      // let isTestTransaction = isTestNetwork(receivingCurrency.network);
      let isTestTransaction = true; // Adjust based on your logic
      const message = await new Paystack(
        isTestTransaction ? "dev" : "prod"
      ).processWebhook(context);

      // Ensure the response is always JSON
      return context.response.status(200).json({
        success: true,
        message:"Webhook processed successfully",
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return context.response.status(500).send({
        error: "Error processing webhook",
        message: error.message,
      });
    }
  }
);
