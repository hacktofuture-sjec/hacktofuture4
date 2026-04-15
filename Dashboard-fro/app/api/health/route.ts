export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      auth: 'up',
      messaging: 'up',
      presence: 'up',
      conversation: 'up',
      monitoring: 'up',
    },
  })
}
