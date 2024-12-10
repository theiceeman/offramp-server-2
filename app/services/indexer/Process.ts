import { fork } from 'child_process';
import { IPCMessage } from 'App/helpers/types'

export const startIndexerProcess = async (txnUniqueId: string) => {
  return new Promise((resolve, reject) => {
    console.log(`starting indexer process...`);

    // Run 'node ace' command with your custom command
    const child = fork('ace', ['run:indexer', txnUniqueId], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']  // Enable IPC communication
    });

    child.stdout?.on('data', (data) => {
      console.log(`Indexer stdout: ${data}`);
    });

    child.stderr?.on('data', (data) => {
      console.error(`Indexer error: ${data}`);
    });

    child.on('message', (message: IPCMessage) => {
      if (message.type === 'socket_emit' && global.io) {
        const { socketId, status, txnId } = message.data;
        console.log('Parent received message:', message);
        global.io.to(socketId).emit('transaction_status', { status, txnId });
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Indexer process exited with code ${code}`));
      } else {
        resolve(true);
      }
    });
  })
};
