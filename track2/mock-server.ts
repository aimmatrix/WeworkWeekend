import { buildAssessment } from "./assess"
import { getFounder } from "./founder"
import { blobToGray, getPhoto } from "./photos"
import { applyVerify, MOCK_MODEL } from "./reduce"
import { readDb, writeDb } from "./store"
import type { AssessRequest, AssessResponse, VerifyRequest, VerifyResponse } from "./types"
import { clutterOf, compareGray } from "./vision"

export async function mockAssess(body: AssessRequest): Promise<AssessResponse> {
  if (!body.officeId) throw new Error("Missing office.")
  if (!Array.isArray(body.photoUrls) || body.photoUrls.length === 0) {
    throw new Error("Add photos before assessing.")
  }
  const photos = await Promise.all(
    body.photoUrls.map(async (url) => {
      const blob = await getPhoto(url)
      const gray = await blobToGray(blob)
      return { url, clutter: clutterOf(gray) }
    }),
  )
  return buildAssessment(photos)
}

export async function mockVerify(body: VerifyRequest): Promise<VerifyResponse> {
  if (!body.taskId || !body.afterUrl) throw new Error("Missing the task or the after photo.")
  const db = readDb()
  const task = db.tasks.find((item) => item.id === body.taskId)
  if (!task) throw new Error("That task isn't on this phone. Publish it from Capture first.")

  const founder = getFounder() || "Founder"
  const now = new Date().toISOString()
  const verificationId = crypto.randomUUID()
  const creditId = crypto.randomUUID()

  if (task.status === "done") {
    const { response } = applyVerify(db, {
      taskId: body.taskId,
      afterUrl: body.afterUrl,
      decision: { passed: true, confidence: 1, reasons: [], remaining_issues: [] },
      founder,
      now,
      model: MOCK_MODEL,
      verificationId,
      creditId,
    })
    return response
  }

  const [beforeBlob, afterBlob] = await Promise.all([getPhoto(task.before_url), getPhoto(body.afterUrl)])
  const [before, after] = await Promise.all([blobToGray(beforeBlob), blobToGray(afterBlob)])
  const decision = compareGray(before, after, task.category)
  const { db: next, response } = applyVerify(db, {
    taskId: body.taskId,
    afterUrl: body.afterUrl,
    decision,
    founder,
    now,
    model: MOCK_MODEL,
    verificationId,
    creditId,
  })
  writeDb(next)
  return response
}
