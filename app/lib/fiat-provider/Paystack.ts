import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import TransactionsController from "App/controllers/http/TransactionsController";
import WebSocketsController from "App/controllers/http/WebSocketsController";
import {
  PROCESS_TYPES,
  supportedChains,
  transactionStatus,
  transactionType,
  userPaymentType,
} from "App/helpers/types";
import Transaction from "App/models/Transaction";
import { Paystack as PaystackSDK } from "paystack-sdk";
import SystemWallet from "../system-wallet/SystemWallet";
import { startIndexerProcess } from "App/services/indexer/Process";
import { IPaymentProvider } from "./interface";
import crypto from "crypto";

const API_BASE_URL = process.env.API_BASE_URL;

interface params {
  accountBank: string;
  accountNumber: string;
  amount: number;
  txRef: string;
}

interface PaystackResponse {
  status: boolean;
  message: string;
  data?: PaystackBankResponseData | PaystackCardResponseData;
}

export interface PaystackBankResponseData {
  reference: string;
  account_number: string;
  account_name: string;
  display_text: string;
  bank: { name: string };
  account_expires_at: string;
}

export interface PaystackCardResponseData {
  authorization_url: string;
  access_code: string;
  reference: string;
  public_key: string;
}
interface PaystackConfig {
  secretKey: string;
  publicKey: string;
  webhookUrl: string;
}

export default class Paystack implements IPaymentProvider {
  private sdk: PaystackSDK;
  private publicKey: string;
  private webhookUrl: string;
  private environment: "dev" | "prod";

  constructor(environment: "dev" | "prod") {
    this.environment = environment;

    const config = this.getConfig(environment);

    if (!config.secretKey || !config.publicKey) {
      throw new Error(`Paystack ${environment} API keys not configured`);
    }

    this.sdk = new PaystackSDK(config.secretKey);
    this.publicKey = config.publicKey;
    this.webhookUrl = config.webhookUrl;
  }

  private getConfig(environment: "dev" | "prod"): PaystackConfig {
    if (environment === "dev") {
      return {
        secretKey: process.env.PAYSTACK_TEST_SECRET_KEY || "",
        publicKey: process.env.PAYSTACK_TEST_PUBLIC_KEY || "",
        webhookUrl: process.env.PAYSTACK_TEST_WEBHOOK_URL || "",
      };
    } else {
      return {
        secretKey: process.env.PAYSTACK_LIVE_SECRET_KEY || "",
        publicKey: process.env.PAYSTACK_LIVE_PUBLIC_KEY || "",
        webhookUrl: process.env.PAYSTACK_WEBHOOK_URL || "",
      };
    }
  }

  /**
   * Initialize a payment for either card or bank transfer
   */
  public async initializePayment(
    txRef: string,
    amount: string,
    email: string,
    paymentType: string
  ): Promise<any> {
    try {
      const amountInKobo = Math.round(parseFloat(amount) * 100);
      const details = {
        reference: txRef,
        amount: amountInKobo.toString(),
        email: email,
        currency: "NGN",
        callback_url: ` ${process.env.FRONTEND_URL}/app/buy/processing?txn=${txRef}`,
        bank_transfer: {
          account_expires_at: "2023-09-19T00:00:00Z",
        },
        channels:
          paymentType === userPaymentType.BANK_TRANSFER
            ? ["bank_transfer"]
            : ["card"],
        metadata: {
          payment_type: paymentType,
          custom_fields: [
            {
              display_name: "Transaction Reference",
              variable_name: "tx_ref",
              value: txRef,
            },
          ],
        },
      };

      let baseResponse: PaystackResponse = {
        status: false,
        message: "",
      };

      // Add bank transfer specific details if applicable
      if (paymentType === userPaymentType.BANK_TRANSFER) {
        const response = (await this.sdk.charge.create(
          details
        )) as PaystackResponse;

        if (!response.status) {
          throw new Error(response.message);
        }
        baseResponse = {
          status: response.status,
          message: response.message,
          data: undefined,
        };
        if (response.data) {
          const bankData = response.data as PaystackBankResponseData;

          baseResponse.data = {
            display_text: bankData.display_text,
            reference: bankData.reference,
            bank: bankData.bank,
            account_number: bankData.account_number,
            account_name: bankData.account_name,
            account_expires_at: bankData.account_expires_at,
          };
        }
      } else if (paymentType === userPaymentType.DEBIT_CARD) {
        const response = await this.sdk.transaction.initialize(details);
        console.log("response", response);
        if (!response.status) {
          throw new Error(response.message);
        }

        baseResponse = {
          status: response.status,
          message: response.message,
          data: undefined,
        };

        if (response.data) {
          const cardData = response.data as PaystackCardResponseData;
          baseResponse.data = {
            authorization_url: cardData.authorization_url,
            reference: cardData.reference,
            access_code: cardData.access_code,
            public_key: this.publicKey,
          };
        }
      }

      return baseResponse;
    } catch (error) {
      console.error("Error in initializePayment:", error);
      throw new Error(
        error.message || "An error occurred while initializing payment"
      );
    }
  }

  public async generateBankAccount(
    txRef: string,
    amount: string,
    email: string
  ): Promise<PaystackResponse> {
    return this.initializePayment(
      txRef,
      amount,
      email,
      userPaymentType.BANK_TRANSFER
    );
  }

  public async initSendBankTransfer({
    accountBank,
    accountNumber,
    amount,
    txRef,
  }: params): Promise<any> {
    try {
      if (!API_BASE_URL || !this.webhookUrl) {
        throw new Error(
          "API_BASE_URL or PAYMENT_PROVIDER_WEBHOOK is not defined"
        );
      }

      const transferDetails = {
        source: "balance",
        amount: amount * 100, // Convert to kobo
        recipient: await this.createTransferRecipient(
          accountNumber,
          accountBank
        ),
        reason: "WT Payment",
        currency: "NGN",
        reference: txRef,
      };

      const response = await this.sdk.transfer.initiate(transferDetails);

      if (response && "status" in response && !response.status) {
        throw new Error("Transfer initiation failed");
      }

      return {
        status: "success",
        data: response,
      };
    } catch (error) {
      console.error(error);
      throw new Error(error);
    }
  }

  private async createTransferRecipient(
    accountNumber: string,
    bankCode: string
  ): Promise<string> {
    const response = await this.sdk.recipient.create({
      type: "nuban",
      name: "Customer",
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    });

    if (!response.status)
      throw new Error("Failed to create recipient: " + response.message);

    if (!response.data?.recipient_code) {
      throw new Error("Failed to get recipient code from response");
    }

    return response.data.recipient_code;
  }

  public async processWebhook({
    request,
    response,
  }: HttpContextContract): Promise<void> {
    try {
      const payload = request.body();
      console.log("Processing Paystack webhook payload:", payload);

      const signature = request.header("x-paystack-signature");

      // Skip signature verification in test mode if needed
      const skipVerification =
        this.environment === "dev" && process.env.NODE_ENV !== "production";

      if (
        !skipVerification &&
        !this.verifyWebhookSignature(payload, signature)
      ) {
        throw new Error("Invalid signature");
      }

      // Extract reference from different possible payload structures
      const reference =
        payload?.data?.reference ||
        payload?.data?.tx_ref ||
        payload?.data?.txref ||
        request.qs().ref; // Check query string too

      if (!reference) {
        throw new Error("No transaction reference found in payload");
      }

      // Check if transaction exists
      let txn = await Transaction.query()
        .preload("recieverCurrency", (query) =>
          query.select("name", "network", "tokenAddress")
        )
        .where("fiat_provider_tx_ref", reference)
        .first();

      if (!txn) {
        throw new Error(`Transaction not found for reference: ${reference}`);
      }

      if (txn.status === transactionStatus.COMPLETED) {
        return response.status(200).send("Transaction already completed");
      }

      // Verify transaction with Paystack
      const verifyResponse = await this.sdk.transaction.verify(reference);

      let txnType: "userBuy" | "userSell" =
        txn.type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";

      let actualAmountUserSends =
        new TransactionsController()._calcActualAmountUserSends([txn], txnType);

      let data = { status: "" };

      // Special handling for test mode
      const isTestTransaction =
        this.environment === "dev" || verifyResponse?.data?.domain === "test";

      // Check if payment was successful
      // In test mode, accept "abandoned" status for bank transfers
      const isSuccessful =
        verifyResponse?.data?.status === "success" ||
        (isTestTransaction &&
          (verifyResponse?.data?.status === "abandoned" ||
            verifyResponse?.data?.status === "ongoing") &&
          (verifyResponse?.data?.channel === "bank_transfer" ||
            verifyResponse?.data?.channel === "card"));

      if (
        isSuccessful &&
        verifyResponse?.data?.amount &&
        verifyResponse.data.amount >= Math.round(actualAmountUserSends * 100) && // Convert to kobo
        verifyResponse?.data?.currency === "NGN"
      ) {
        data.status = transactionStatus.TRANSFER_CONFIRMED;
      } else {
        data.status = transactionStatus.FAILED;
      }

      // Store the provider response for reference
      const updateResult = await Transaction.query()
        .where("fiat_provider_tx_ref", reference)
        .update({
          status: data.status,
          fiat_provider_result: JSON.stringify(verifyResponse?.data || {}),
        });

      // The update was successful if updateResult is greater than 0
      const updateSuccessful = Array.isArray(updateResult)
        ? updateResult[0] > 0
        : updateResult > 0;

      if (!updateSuccessful) {
        console.error(
          `Failed to update transaction with reference ${reference}`
        );
        return response.status(500).send("Failed to update transaction");
      }

      if (data.status === transactionStatus.TRANSFER_CONFIRMED) {
        let recievingCurrencyNetwork = txn?.recieverCurrency
          .network as unknown as supportedChains;

        let actualAmountUserReceives =
          new TransactionsController()._calcActualAmountUserRecieves(
            [txn],
            txnType
          );

        if (!txn?.recievingWalletAddress) {
          throw new Error("recievingWalletAddress does not exist");
        }

        // Start indexer process
        // startIndexerProcess(txn.uniqueId);

        // Convert amount to string if it's a BigNumber
        //  const amountToSend = typeof actualAmountUserReceives.toString === 'function'
        //  ? actualAmountUserReceives.toString()
        //  : actualAmountUserReceives;

        //  console.log(`Transferring ${amountToSend} tokens to ${txn.recievingWalletAddress} on network ${recievingCurrencyNetwork}`);

        // Create system wallet with explicit network
        //  const systemWallet = new SystemWallet(recievingCurrencyNetwork);

        // Check if provider is initialized
        //  if (!systemWallet) {
        //    throw new Error(`Provider not initialized for network: ${recievingCurrencyNetwork}`);
        //  }

        // Transfer tokens to user
        //   await new SystemWallet(recievingCurrencyNetwork).transferToken(
        //     amountToSend,
        //     txn.recieverCurrency.tokenAddress,
        //     txn.recievingWalletAddress
        //   );
      }

      // Notify user of status update
      // await new WebSocketsController().emitStatusUpdateToClient(
      //   txn?.uniqueId as string
      // );

      // Query the transaction again to get the updated status
      const updatedTxn = await Transaction.query()
        .where("unique_id", txn.uniqueId)
        .first();

      console.log(
        `Transaction ${txn.uniqueId} current status: ${updatedTxn?.status}`
      );

      // After processing, check if payment was successful and update to COMPLETED
      if (
        updatedTxn &&
        updatedTxn.status === transactionStatus.TRANSFER_CONFIRMED
      ) {
        // Update to COMPLETED status
        await Transaction.query().where("unique_id", txn.uniqueId).update({
          status: transactionStatus.COMPLETED,
        });

        console.log(`Transaction ${txn.uniqueId} updated to COMPLETED status`);
        await new WebSocketsController().emitStatusUpdateToClient(
          txn?.uniqueId as string
        );
      }

      response.status(200).send("webhook processed.");
    } catch (error) {
      console.error("Webhook processing failed:", error);
      response
        .status(400)
        .send({ message: "Webhook processing failed", error: error.message });
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: any, signature?: string): boolean {
    if (!signature) {
      console.error("Missing signature");
      return false;
    }

    try {
      const config = this.getConfig(this.environment);
      const hash = crypto
        .createHmac("sha512", config.secretKey)
        .update(JSON.stringify(payload))
        .digest("hex");

      return hash === signature;
    } catch (error) {
      console.error("Error verifying signature:", error);
      return false;
    }
  }

  /**
   * Get public key
   */
  public getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Get environment
   */
  public getEnvironment(): string {
    return this.environment;
  }
}
