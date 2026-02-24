import express from "express";
import {
  LambdaClient,
  SendDurableExecutionCallbackSuccessCommand,
  SendDurableExecutionCallbackFailureCommand,
} from "@aws-sdk/client-lambda";
import open from "open";

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// AWS Lambda client
const lambdaClient = new LambdaClient();

async function sendSuccessSignal(
  callbackID: string,
  callbackData: string,
): Promise<void> {
  console.log("Sending success signal");
  const command = new SendDurableExecutionCallbackSuccessCommand({
    CallbackId: callbackID.replaceAll("\n", "").trim(),
    Result: Buffer.from(callbackData),
  });
  await lambdaClient.send(command);
}

async function sendErrorSignal(callbackID: string): Promise<void> {
  console.log("Sending error signal");
  const command = new SendDurableExecutionCallbackFailureCommand({
    CallbackId: callbackID.replaceAll("\n", "").trim(),
    Error: {
      ErrorMessage: "An error occurred",
      ErrorType: "CustomError",
    },
  });
  await lambdaClient.send(command);
}

// Serve the HTML page
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Send Callback Signal</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.min.css">
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.41.0/min/vs/loader.js"></script>
        <style>
            :root {
                --background: #1e1e1e;
                --background-body: #282c34;
                --form-text: #d4d4d4;
            }
            .message {
                padding: 10px;
                margin: 10px 0;
                border-radius: 4px;
                text-align: center;
            }
            .success {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            .error {
                background-color: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .htmx-request {
                opacity: 0.5;
            }
            .htmx-request button {
                pointer-events: none;
            }
            form button {
                margin-top: 10px;
                display: block;
                margin-left: auto;
                margin-right: 0;
            }
        </style>
    </head>
    <body>
        <h1>Send Callback Signal</h1>
        <form hx-post="/send-signal" 
              hx-target="#messageContainer" 
              hx-swap="innerHTML"
              hx-on::after-request="this.reset()">
            <div>
                <label for="signalType">Signal Type:</label>
                <select name="signalType" required>
                    <option value="success" selected>Success</option>
                    <option value="error">Error</option>
                </select>
            </div>
            <div>
                <label for="callbackID">Callback ID:</label>
                <textarea name="callbackID" required placeholder="Enter callback ID"></textarea>
            </div>
            <div>
                <label for="callbackData">Callback Data:</label>
                <textarea name="callbackData" id="callbackData" style="display:none;"></textarea>
                <div id="jsonEditor" style="min-height:100px; height:300px; resize: vertical; overflow: auto;"></div>
            </div>
            <button type="submit">Send Signal</button>
        </form>
        <div id="messageContainer"></div>
        <script>
            require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.41.0/min/vs' }});
            require(['vs/editor/editor.main'], function() {
                const editor = monaco.editor.create(document.getElementById('jsonEditor'), {
                language: 'json',
                theme: 'vs-dark',
                automaticLayout: true
                });

                // Sync Monaco editor content to the hidden textarea on every change
                editor.onDidChangeModelContent(() => {
                    document.getElementById('callbackData').value = editor.getValue();
                });
            });
        </script>
    </body>
    </html>
  `);
});

// API endpoint to handle signal sending
app.post("/send-signal", async (req, res) => {
  try {
    const { signalType, callbackID, callbackData } = req.body;

    if (!signalType || !callbackID) {
      return res
        .status(400)
        .send(
          `<div class="message error">Signal type and callback ID are required</div>`,
        );
    }

    if (signalType === "success") {
      await sendSuccessSignal(callbackID, callbackData)
        .then(() => {
          res.send(
            `<div class="message success">Success signal sent for callback ID: ${callbackID}</div>`,
          );
        })
        .catch((error) => {
          console.error("Error sending success signal:", error);
          res.send(
            `<div class="message error">Failed to send success signal for callback ID: ${callbackID}
                <br>
             <code>${error.message}</code>
            </div>`,
          );
        });
    } else if (signalType === "error") {
      await sendErrorSignal(callbackID)
        .then(() => {
          res.send(
            `<div class="message success">Error signal sent for callback ID: ${callbackID}</div>`,
          );
        })
        .catch((error) => {
          console.error("Error sending error signal:", error);
          res.send(
            `<div class="message error">Failed to send error signal for callback ID: ${callbackID}
                <br>
                <code>${error.message}</code>
            </div>`,
          );
        });
    } else {
      res.send(
        `<div class="message error">Invalid signal type. Please use "success" or "error".</div>`,
      );
    }
  } catch (error) {
    console.error("An error occurred:", error);
    res
      .status(500)
      .send(
        `<div class="message error">An error occurred: ${error.message}</div>`,
      );
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(
    "Open your browser and navigate to the URL above to use the callback signal interface.",
  );
  open(`http://localhost:${port}`);
});
