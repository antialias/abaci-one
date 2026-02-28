/**
 * Helper functions for sending messages on the OpenAI Realtime data channel.
 */

/** Send a tool call response (function_call_output) and optionally prompt a model response. */
export function sendToolResponse(
  dc: RTCDataChannel,
  callId: string,
  output: unknown,
  promptResponse = true
) {
  dc.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    })
  )
  if (promptResponse) {
    dc.send(JSON.stringify({ type: 'response.create' }))
  }
}

/** Send a system-level text message and optionally prompt a model response. */
export function sendSystemMessage(dc: RTCDataChannel, text: string, promptResponse = false) {
  dc.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    })
  )
  if (promptResponse) {
    dc.send(JSON.stringify({ type: 'response.create' }))
  }
}

/**
 * Send a combined text + optional image context update as a single conversation item.
 * More efficient than separate text + image messages — uses one item in the context window.
 */
export function sendContextUpdate(
  dc: RTCDataChannel,
  text: string,
  base64DataUrl?: string | null,
  promptResponse = false
) {
  const content: Array<Record<string, string>> = [
    { type: 'input_text', text },
  ]
  if (base64DataUrl) {
    const base64 = base64DataUrl.includes(',') ? base64DataUrl.split(',')[1] : base64DataUrl
    content.push({ type: 'input_image', image: base64 })
  }
  dc.send(JSON.stringify({
    type: 'conversation.item.create',
    item: { type: 'message', role: 'user', content },
  }))
  if (promptResponse) {
    dc.send(JSON.stringify({ type: 'response.create' }))
  }
}

/**
 * Send an image to the conversation via input_image content part.
 * Used for mid-conversation visual context (e.g. construction screenshots).
 */
export function sendImageContext(dc: RTCDataChannel, base64DataUrl: string, promptResponse = false) {
  // Extract the base64 data from the data URL
  const base64 = base64DataUrl.includes(',') ? base64DataUrl.split(',')[1] : base64DataUrl

  dc.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_image',
            image: base64,
          },
        ],
      },
    })
  )
  if (promptResponse) {
    dc.send(JSON.stringify({ type: 'response.create' }))
  }
}
