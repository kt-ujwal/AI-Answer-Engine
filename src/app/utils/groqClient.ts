import Groq from "groq-sdk"

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export async function getGroqResponse(message: string){
    const messages: ChatMessage[] = [
        {role:"system", content:"You are an academic expert, you always cite your sources and base your responses only on the context that you have been provided"},
        {role:"user", content:message},
    ];

    console.log("Starting Groq API request");
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages
    })
    console.log("Recieved Groq API request", response);
    return response.choices[0].message.content;
}