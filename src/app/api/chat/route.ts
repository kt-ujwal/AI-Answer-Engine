// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer
import { NextResponse } from "next/server"
import { getGroqResponse } from "@/app/utils/groqClient";
import { scrapeUrl, urlPattern } from "@/app/utils/scraper";

export async function POST(req: Request) {
  try {
    const { message } = await req.json()
    console.log("message recieved:", message);
    const url = message.match(urlPattern);
    let scrapedContent = ""
    if (url){
      console.log("Url Found",url);
      const scraperResponse = await scrapeUrl(url);
      console.log("Scraped Content",scrapedContent);
      console.log("Scraper Response:", scraperResponse);
      scrapedContent = scraperResponse.content;
    }
    const userQuery = message.replace(url? url[0]: '','').trim();
    const prompt = `
    Answer my question: "${userQuery}"
    Based on hte following content:
    <content>
    ${scrapedContent}
    </content>
    `
    console.log("PROMPT:", prompt);
    const response = await getGroqResponse(message);
    return NextResponse.json({message: response})

  } catch (error) {
    return NextResponse.json({message: String(error)})

  }
}
