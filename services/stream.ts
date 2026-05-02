import { StreamChat } from 'stream-chat';

const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY!;

export const streamClient = StreamChat.getInstance(apiKey);
