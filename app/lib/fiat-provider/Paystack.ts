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

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

const API_BASE_URL = process.env.API_BASE_URL;
const PAYMENT_PROVIDER_WEBHOOK = process.env.PAYMENT_PROVIDER_WEBHOOK;

interface params {
  accountBank: string;
  accountNumber: string;
  amount: number;
  txRef: string;
}

interface PaystackResponse {
  status: boolean;
  message: string;
  data?: PaystackResponseData;
}

interface PaystackResponseData {
  reference: string;
  account_number: string;
  account_name: string;
  display_text: string;
  bank: { name: string };
  account_expires_at: string;
}

export default class Paystack implements IPaymentProvider {
  private sdk: PaystackSDK;
  private publicKey: string;

  constructor(environment: "prod" | "dev") {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Paystack API keys not configured");
    }
    this.sdk = new PaystackSDK(PAYSTACK_SECRET_KEY);
    // this.publicKey = PAYSTACK_PUBLIC_KEY;
  }

  public async initializePayment(
    txRef: string,
    amount: string,
    email: string,
    paymentType: string
  ): Promise<PaystackResponse> {
    try {
      const details = {
        reference: txRef,
        amount: (parseFloat(amount) * 100).toString(),
        email: email,
        currency: "NGN",
        callback_url: `${API_BASE_URL}${PAYMENT_PROVIDER_WEBHOOK}`,
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

      const response = (await this.sdk.charge.create(
        details
      )) as PaystackResponse;

      if (!response.status) {
        throw new Error(response.message);
      }

      const baseResponse: PaystackResponse = {
        status: response.status,
        message: response.message,
        data: undefined,
      };

      // Add bank transfer specific details if applicable
      if (paymentType === userPaymentType.BANK_TRANSFER && response.data) {
        baseResponse.data = {
          display_text: response.data.display_text,
          reference: response.data.reference,
          bank: response.data.bank,
          account_number: response.data.account_number,
          account_name: response.data.account_name,
          account_expires_at: response.data.account_expires_at,
        };
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
      if (!API_BASE_URL || !PAYMENT_PROVIDER_WEBHOOK) {
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
      // const PROCESS_TYPE = PROCESS_TYPES.APP;

      const payload = request.body();
      const signature = request.header("x-paystack-signature");

      // Verify request is from Paystack
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error("Invalid signature");
      }

      // Only process successful transactions
      if (payload.event !== "transfer.success") {
        throw new Error("Invalid event type");
      }

      // Check if transaction exists and isn't already processed
      let txn = await Transaction.query()
        .preload("recieverCurrency", (query) =>
          query.select("name", "network", "tokenAddress")
        )
        .where("fiat_provider_tx_ref", payload.data.reference);

      if (!txn.length) {
        throw new Error("Transaction not found");
      }

      if (txn[0].status === transactionStatus.COMPLETED) {
        throw new Error("Transaction already completed");
      }

      // Verify transaction with Paystack
      const verifyResponse = await this.sdk.transaction.verify(
        payload.data.reference
      );

      let txnType: "userBuy" | "userSell" =
        txn[0].type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";
      let actualAmountUserSends =
        new TransactionsController()._calcActualAmountUserSends(txn, txnType);

      let data = { status: "" };
      if (
        verifyResponse?.data?.status === "success" &&
        verifyResponse?.data?.amount >= actualAmountUserSends * 100 && // Convert to kobo
        verifyResponse?.data?.currency === "NGN"
      ) {
        data.status = transactionStatus.TRANSFER_CONFIRMED;
      } else {
        data.status = transactionStatus.FAILED;
      }

      if (data.status === transactionStatus.TRANSFER_CONFIRMED) {
        await Transaction.query()
          .where("fiat_provider_tx_ref", payload.data.reference)
          .update(data);

        let recievingCurrencyNetwork = txn[0].recieverCurrency
          .network as unknown as supportedChains;
        let actualAmountUserReceives =
          new TransactionsController()._calcActualAmountUserRecieves(
            txn,
            txnType
          );

        if (!txn[0].recievingWalletAddress) {
          throw new Error("recievingWalletAddress does not exist");
        }

        // Start indexer process
        startIndexerProcess(txn[0].uniqueId);

        new SystemWallet(recievingCurrencyNetwork).transferToken(
          actualAmountUserReceives,
          txn[0].recieverCurrency.tokenAddress,
          txn[0].recievingWalletAddress
        );
      }

      await new WebSocketsController().emitStatusUpdateToClient(
        txn[0].uniqueId
      );

      response.status(200).send("webhook processed.");
    } catch (error) {
      console.error("Webhook processing failed:", error);
      response
        .status(400)
        .send({ message: "Webhook processing failed", error: error.message });
    }
  }

  private verifyWebhookSignature(payload: any, signature?: string): boolean {
    if (!signature || !PAYSTACK_SECRET_KEY) return false;

    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    return hash === signature;
  }
}
