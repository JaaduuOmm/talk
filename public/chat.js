/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
  {
    role: "assistant",
    content:
      "Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
  },
];
let isProcessing = false;

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the streaming response
 */
async function sendMessage() {
  const message = userInput.value.trim();

  // Don't send empty messages
  if (message === "" || isProcessing) return;

  // Disable input while processing
  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  // Add user message to chat
  addMessageToChat("user", message);

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";

  // Show typing indicator
  typingIndicator.classList.add("visible");

  // Add message to history
  chatHistory.push({ role: "user", content: message });

  try {
    // Create new assistant response element
    const assistantMessageEl = document.createElement("div");
    assistantMessageEl.className = "message assistant-message";
    assistantMessageEl.innerHTML = "<p></p>";
    chatMessages.appendChild(assistantMessageEl);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Send request to API with streaming enabled
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/plain", // Specify we want streaming response
      },
      body: JSON.stringify({
        messages: chatHistory,
        stream: true, // Enable streaming
      }),
    });

    // Handle errors
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      
      // Process each complete line
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines or comments
        if (!trimmedLine || trimmedLine.startsWith(':')) {
          continue;
        }
        
        // Handle SSE data format
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6); // Remove 'data: ' prefix
          
          // Check for end of stream marker
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const jsonData = JSON.parse(data);
            
            // Handle different response formats
            let content = '';
            if (jsonData.response) {
              content = jsonData.response;
            } else if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
              content = jsonData.choices[0].delta.content;
            } else if (jsonData.content) {
              content = jsonData.content;
            } else if (typeof jsonData === 'string') {
              content = jsonData;
            }
            
            if (content) {
              // Append new content to existing text
              responseText += content;
              assistantMessageEl.querySelector("p").textContent = responseText;
              
              // Scroll to bottom
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          } catch (e) {
            // If it's not JSON, treat as plain text
            if (data && data !== '[DONE]') {
              responseText += data;
              assistantMessageEl.querySelector("p").textContent = responseText;
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }
        } else if (trimmedLine.startsWith('event: ')) {
          // Handle event types if needed
          const event = trimmedLine.slice(7);
          console.log('SSE Event:', event);
        }
      }
    }
    
    // Process any remaining buffer content
    if (buffer.trim()) {
      try {
        const jsonData = JSON.parse(buffer.trim());
        if (jsonData.response) {
          responseText += jsonData.response;
          assistantMessageEl.querySelector("p").textContent = responseText;
        }
      } catch (e) {
        // Ignore parsing errors for remaining buffer
      }
    }

    // Add completed response to chat history
    if (responseText) {
      chatHistory.push({ role: "assistant", content: responseText });
    }
    
  } catch (error) {
    console.error("Error:", error);
    
    // Remove the empty assistant message element if it was created
    const lastMessage = chatMessages.lastElementChild;
    if (lastMessage && lastMessage.classList.contains('assistant-message') && 
        !lastMessage.querySelector('p').textContent.trim()) {
      lastMessage.remove();
    }
    
    addMessageToChat(
      "assistant",
      "Sorry, there was an error processing your request. Please try again."
    );
  } finally {
    // Hide typing indicator
    typingIndicator.classList.remove("visible");

    // Re-enable input
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  messageEl.innerHTML = `<p>${escapeHtml(content)}</p>`;
  chatMessages.appendChild(messageEl);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Helper function to escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
