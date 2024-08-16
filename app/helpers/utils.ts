import Env from '@ioc:Adonis/Core/Env'
import { v4 as uuidv4 } from 'uuid';
import { NETWORKS, supportedChains } from './types';
import { ethers } from 'ethers';

export function genRandomUuid() {
  return String(uuidv4()).toLowerCase()
}

export function formatErrorMessage(error: any) {
  // console.log('vv', error)
  // console.log('sss', String(error)?.split('Error:'))
  let data: string;
  let code: number;

  if (error && error.messages) {
    const errorMessage = error.messages.errors[0];
    data = `${errorMessage.message}`;
    code = 400;
  } else if (error && error.code === 'E_ROW_NOT_FOUND') {
    data = 'Resource not found!';
    code = 404;
  } else if (error && error.code === 'E_INVALID_AUTH_PASSWORD') {
    data = 'Password does not match!';
    code = 401;
  } else if (error && error.code === 'E_UNAUTHORIZED_ACCESS') {
    data = 'Authentication error. Sign in again.';
    code = 401;
  } else if (String(error)?.split('Error:')) {
    data = String(error)?.split('Error:')[1]
    code = 500
  } else {
    data = 'Unexpected error. Please, contact an Administrator.';
    code = 500;
  }

  console.error({
    code: error.code,
    data: data,
    message: error.message,
    stack: error.stack
  })

  return {
    error: true,
    data: data,
    details: error.message,
    code,
  };
}


export function formatSuccessMessage(message: string, result: any) {
  return {
    error: false,
    data: message,
    code: 200,
    result
  };
}

export function getRpcUrl(network: supportedChains) {
  let url
  switch (network) {
    case 'bsc':
      url = Env.get('BSC_RPC');
      break;
    case 'sepolia':
      url = Env.get('SEPOLIA_RPC');
      break;
    case 'assetchain_testnet':
      url = Env.get('ASSETCHAIN_TESTNET_RPC');
      break;
    case 'local':
      url = 'http://127.0.0.1:8545/';
      break;
    default:
      break;
  }
  return url;

}


export function getEthersProvider(network: supportedChains) {
  let client
  switch (network) {
    case 'bsc':
      client = new ethers.providers.JsonRpcProvider(Env.get('BSC_RPC'));
      break;
    case 'sepolia':
      client = new ethers.providers.JsonRpcProvider(Env.get('SEPOLIA_RPC'));
      break;
    case 'assetchain_testnet':
      client = new ethers.providers.JsonRpcProvider(Env.get('ASSETCHAIN_TESTNET_RPC'));
      break;
    case 'local':
      client = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
      break;
    default:
      break;
  }
  return client;
}


export const contractAddress = {
  bsc: {
    FACTORY_CONTRACT_ADDRESS: '0x...',
    WALLET_CONTRACT_ADDRESS: '0x...',
  },
  sepolia: {
    FACTORY_CONTRACT_ADDRESS: '0x028bA0F1A498AdCD86535053bd357899Bf9ADAb9',
    WALLET_CONTRACT_ADDRESS: '0x5A110FF22233AD6AC6196948f72bEcE1f5196179',
  },
  assetchain_testnet: {
    FACTORY_CONTRACT_ADDRESS: '0x381AFE71090cf71B75a886EA8833dfc9683c57b6',
    WALLET_CONTRACT_ADDRESS: '0x43d77792b5992fE8c3e1F863e276c7826A806c9C',
  }
}

export const isTestNetwork = (network) => {
  return NETWORKS.TEST.includes(network);
};

// export class CustomError extends Error {
//   code;
//   constructor(code, message) {
//     super(message);
//     this.code = code;
//   }
// }

export function roundToTwoDecimalPlace(number, decimalPlaces = 2) {
  if (isNaN(number) || isNaN(decimalPlaces)) {
    throw new Error("Both arguments must be numbers.");
  }
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(number * factor) / factor;
}
