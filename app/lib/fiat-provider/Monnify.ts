import { Request } from "App/helpers/https";

export default class Monnify {
    private baseUrl;

    constructor(environment: 'prod' | 'dev') {
        this.baseUrl = environment === 'prod' ? 'https://api.monnify.com' : 'https://sandbox.monnify.com'

    }

    /**
     * Generates access token, to autheticate subsequent requests to monnify.
     * @returns AccessToken
     */
    public async generateAccessToken(): Promise<string> {
        try {
            const credentials = `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`;
            const authToken = Buffer.from(credentials).toString('base64');

            let url = `${this.baseUrl}/api/v1/auth/login`;
            let config = {
                headers: {
                    'Authorization': `Basic ${authToken}`
                }
            }
            let response = await Request.post(url, {}, config)
            if (!response.ok)
                throw new Error('monnify connection failed!')

            let data = response.data.data;
            return data.responseBody.accessToken
        } catch (error) {
            console.error(error)
            throw new Error(error)
        }
    }

    /**
     * Returns array of monnify supported banks.
     * @returns Array
     */
    public async getSupportedBanks() {
        let authToken = await this.generateAccessToken();
        let url = `${this.baseUrl}/api/v1/banks`;
        let config = {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        }
        let response = await Request.get(url, config)
        if (!response.ok)
            throw new Error('monnify connection failed!')

        let data = response.data.data.responseBody;
        return data
    }

    public async initiateSingleTransfer(amount: number, txnId, acctNo, currencySymbol, bankCode) {
        let payload = {
            amount,
            reference: `referen00ce---${txnId}`,
            narration: "offramp transaction",
            destinationBankCode: bankCode,
            destinationAccountNumber: acctNo,
            currency: currencySymbol,
            sourceAccountNumber: process.env.MONNIFY_WALLET_ACCT_NO
        }
        let authToken = await this.generateAccessToken();
        let url = `${this.baseUrl}/api/v2/disbursements/single`;
        let config = {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        }
        let response = await Request.post(url, payload, config)
        if (!response.ok)
            throw new Error('monnify connection failed!')

    }


}
