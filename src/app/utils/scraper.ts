import axios from "axios";
import * as cheerio from "cheerio";
import { error } from "console";
import { Logger } from "./logger";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

//Cache TTL in seconds (7 days)
const CACHE_TTL = 7 * (24*60*60);
const MAX_CACHE_SIZE = 1024000; // 1MB limit for cached content

const logger = new Logger("scraper")

export const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%._\+~#?&//=]*)/gi;

function cleanText(text: string): string {
    return text.replace(/\s+/g," ").replace(/\n+/g, " ").trim();
}

export async function scrapeUrl(url:string)
{
   try{
    logger.info(`Starting scrape process for: ${url}`);
    logger.debug(`URL value: ${JSON.stringify(url)}, type: ${typeof url}`);

    if (Array.isArray(url)) {
        logger.warn(`Received URL as an array. Using the first element: ${url[0]}`);
        url = url[0]; // Use the first element if it's an array
    }

    if (typeof url !== "string" || !url.trim()) {
        logger.error(`Invalid URL provided: ${url}`);
        return {
            url: "",
            title: "",
            headings: { h1: "", h2: "" },
            metaDescription: "",
            content: "",
            error: "Invalid URL provided",
        };
    }

    const cached = await getCachedContent(url);
    if(cached) {
        logger.info(`Using cached content for:${url}`);
        return cached;
    }
    logger.info(`Cache miss - proceesing with fresh scrape for:${url}`);
     const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    // remove script, style tags, and comments
    $("script").remove();
    $("style").remove();
    $("noscript").remove();
    $("iframe").remove();
    //extract useful info
    const title = $("title").text();
    const metaDescription = $('meta[name="description"]').attr("content") || "";
    const h1 =$("h1")
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    const h2 =$("h2")
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    // get text from important elements
    const articleText =$("article")
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    const mainText =$("main")
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    const contentText =$('.content, #content, [class*="content"]')
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    //get all pragraphs
    const paragraphs =$("p")
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    //get list items
    const listItems =$("li")
    .map((_,el)=>$(el).text())
    .get()
    .join(" ");
    //combine all content
    let combinedContent = [
        title,
        metaDescription,
        h1,
        h2,
        articleText,
        mainText,
        contentText,
        paragraphs,
        listItems,
    ].join(" ");
    // clean and truncate the content
    combinedContent = cleanText(combinedContent).slice(0,40000);
    const finalResponse = {
        url,
        title: cleanText(title),
        headings:{
            h1:cleanText(h1),
            h2: cleanText(h2),
        },
        metaDescription: cleanText(metaDescription),
        content: combinedContent,
        error: null,
    };
    logger.info(`Final response object: ${JSON.stringify(finalResponse, null, 2)}`);
    await cacheContent(url, finalResponse);
    return finalResponse;

}catch (error){
    console.error(`Error Scraping ${url}:`,error);
    return {
    url,
    title: "",
    headings:{ h1:"", h2: ""},
    metaDescription: "",
    content: "",
    error: "Failed to scrape URL",
    };
}
}

export interface ScrapedContent {
    url: string;
    title: string;
    headings: {
        h1: string;
        h2: string;
    };
    metaDescription: string;
    content: string;
    error: string | null;
    cachedAt?: number;
}

//validation function for scrapperContent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidScrapedContent(data: any): data is ScrapedContent {
    return (
        typeof data === "object" &&
        data !== null &&
        typeof data.url === "string" && 
        typeof data.title === "string" &&
        typeof data.headings === "object" &&
        data.headings !== null &&
        typeof data.headings.h1 === "string" &&
        typeof data.headings.h2 === "string" &&
        typeof data.metaDescription === "string" &&
        typeof data.content === "string" &&
        (data.error === null || typeof data.error === "string")
    );
}

//function to get cahce key for a url with sanitization
function getCacheKey(url:string): string {
    
    const santizedUrl = url.toString().substring(0,200); //Limit key length
    return `scrape:${santizedUrl}`;
}

//function to get cached content with error handling
async function getCachedContent(url:string): Promise<ScrapedContent | null> {
    try{
        const cacheKey = getCacheKey(url);
        logger.info(`Checking cache for key: ${cacheKey}`);
        const cached = await redis.get(cacheKey);

        if(!cached){
            logger.info(`Cache miss - No cahced content found for:${url}`);
            return null;
        }

        logger.info(`cache hit - Found cached content for ${url}`);
        // handle both string and object responses from redis
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsed: any;
        if(typeof cached === "string"){
            try{
                parsed = JSON.parse(cached);
            }
            catch (parseError){
                logger.error(`JSON parse error for cached content: ${parseError}`);;
                await redis.del(cacheKey);
                return null;
            }
        }
        else{
            parsed = cached;
        }
        if(isValidScrapedContent(parsed)){
            const age = Date.now() - (parsed.cachedAt || 0);
            logger.info(`Cached content age: ${Math.round(age/1000/60)} minutes`);
            return parsed;
        }
        logger.warn(`Invalid cached content format for URL:${url}`);
        await redis.del(cacheKey);
        return null;
    }
    catch (error){
        logger.error(`Cached returieval error: ${error}`);
        return null;
    }
}

// function to cache scraped content with error handling
async function cacheContent(
    url:string,
    content: ScrapedContent
): Promise<void>{
    try {
        const cacheKey = getCacheKey(url);
        content.cachedAt = Date.now();

        //validate content before sanitization
        if(!isValidScrapedContent(content)){
            logger.error(`Attemtpted to cache invalid content format for URL:${url}`);
            return;
        }

        const serialized = JSON.stringify(content);

        if(serialized.length > MAX_CACHE_SIZE){
            logger.warn(
                `Content too large to cache for URL: ${url} (${serialized.length} bytes)`
            );
            return;
        }

        await redis.set(cacheKey, serialized, {ex: CACHE_TTL});

        logger.info(
            `Succesfully cached content for ${url} (${serialized.length} bytes, TTL: ${CACHE_TTL})`
        );
    }
    catch(error){
        logger.error(`Cache storage error: ${error}`);

    }
}
