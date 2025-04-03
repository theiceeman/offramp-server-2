import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { supportedChains } from 'App/helpers/types'
import { getRpcUrl } from 'App/helpers/utils'
import axios from 'axios'


interface RpcStatusResponse {
  chain: supportedChains
  url: string
  live: boolean
  error?: string
}

export default class RpcStatusController {
  /**
   * Check status of all RPCs
   */
  public async checkStatus({ response }: HttpContextContract) {

    const chains = Object.values(supportedChains)
    const statusPromises = chains.map(async (chain) => {
      const url = getRpcUrl(chain)

      // Skip chains that don't have a configured RPC URL
      if (!url) {
        return {
          chain, url: 'Not configured', live: false, error: 'RPC URL not configured',
        }
      }

      try {
        const result = await this.checkRpcAlive(url)

        return {
          chain, url, live: result.success,
          ...(result.error ? { error: result.error } : {})
        }
      } catch (error) {
        return {
          chain, url, live: false, error: error.message || 'Unknown error occurred',
        }
      }
    })

    const statusResults: RpcStatusResponse[] = await Promise.all(statusPromises)

    return response.status(200).json({
      success: true,
      data: statusResults
    })
  }

  /**
   * Check if an RPC endpoint is alive by making an eth_getBalance request
   */
  private async checkRpcAlive(rpcUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Create the JSON-RPC request payload
      const payload = {
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [
          // Using Ethereum null address as a test subject
          '0x0000000000000000000000000000000000000000',
          'latest'
        ],
        id: 1
      }

      // Make the RPC request
      const response = await axios.post(rpcUrl, payload, {
        headers: { 'Content-Type': 'application/json' }, timeout: 5000, // 5 secs
      })

      // Check if we got a valid response
      if (response.data && response.data.result) {
        return { success: true }
      } else {
        return { success: false, error: 'Invalid response from RPC endpoint' }
      }
    } catch (error) {
      return { success: false, error: error.message || 'Failed to connect to RPC endpoint' }
    }
  }
}
