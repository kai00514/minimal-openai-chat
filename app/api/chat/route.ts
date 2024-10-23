import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    organization: process.env.OPENAI_ORG_ID!,  // 組織IDを指定
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { messages } = await req.json();

    // チャットコンプリーションAPIを呼び出す
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      stream: false, // ストリーミングを無効化
      messages: messages,
    });

    console.log('OpenAI API response:', response);
    console.log('OpenAI API message:', response.choices[0].message);


    // ストリーミングが不要な場合はここでテキストを処理
    const completionText = response.choices[0].message?.content || '';

    // レスポンスをそのまま返す
    return NextResponse.json({ completion: completionText });

  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
