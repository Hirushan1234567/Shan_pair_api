export default async () => {
  return new Response(
    JSON.stringify({
      name: "SHAN MINI BOT V1",
      status: "online",
      message: "API is working!"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
};
