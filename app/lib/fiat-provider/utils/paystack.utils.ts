
import { Request } from "../../../helpers/https"


/**
 * This allows you create beneficiaries that you transfer money to.
 * @param bankCode
 * @param accountNumber
 * @returns
 */
export async function createTransferRecipient(bankCode, accountNumber, userEmail): Promise<{ recipientCode: string }> {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    };

    const payload = {
      type: "nuban",
      name: userEmail,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN"
    }

    const response = await Request.post(`${this.baseUrl}/charge`, payload, {headers});
    if (!response.ok) {
      throw new Error('creating transfer recipient failed');
    }

    return { recipientCode: response.data.data.recipient_code };
  } catch (error) {
    throw new Error(`Failed to create transfer recipient: ${error.message}`);
  }
}
