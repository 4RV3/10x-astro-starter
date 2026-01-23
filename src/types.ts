import type { CardRow, ProfileRow } from "./db/database.types"

/**
 * Utility helpers
 */
type ISODateString = string

/**
 * AUTH / SESSION
 * ------------------------------------------------------------------
 */

// 1. Register command: /auth/register (request body)
export interface RegisterCommand {
  email: string
  password: string
  username: string
}

// 2. Login command: /auth/login (request body)
export interface LoginCommand {
  username: string
  password: string
}

// 3. Session DTO (shared in auth responses)
export interface SessionDTO {
  access_token: string
  expires_at: number
}

// 4. Minimal auth user representation (from Supabase Auth)
export interface AuthUserDTO {
  id: string
  email: string
}

// 5. Profile DTO used in auth responses (subset of ProfileRow)
export type ProfileDTO = Pick<ProfileRow, "id" | "username" | "created_at" | "updated_at">

// 6. /auth/register 201 body
export interface RegisterResponseDTO {
  user: AuthUserDTO
  profile: ProfileDTO
  session: SessionDTO
}

// 7. /auth/login 200 body
export interface LoginResponseDTO {
  user: AuthUserDTO
  profile: Pick<ProfileRow, "id" | "username">
  session: SessionDTO
}

// 8. /auth/me 200 body
export interface MeResponseDTO {
  user: AuthUserDTO
  profile: ProfileDTO
}

/**
 * PROFILES
 * ------------------------------------------------------------------
 */

// 9. /profiles/me GET 200
export type ProfileMeResponseDTO = ProfileDTO

// 10. /profiles/me PATCH command
export interface UpdateProfileCommand {
  username: string
}

// 11. /profiles/me PATCH 200
export type UpdateProfileResponseDTO = ProfileDTO

/**
 * CARDS (CRUD)
 * ------------------------------------------------------------------
 */

// Card DTO exposed to clients – full view of a card row
export type CardDTO = CardRow

// 12. /cards POST command (manual create)
export interface CreateCardCommand {
  front: string
  back: string
  source_snippet: string
  // origin, owner_id, scheduling fields are derived server-side
}

// 13. /cards POST 201 response
export type CreateCardResponseDTO = CardDTO

// 14. /cards GET query params model (for internal typing)
export interface ListCardsQuery {
  page?: number
  page_size?: number
  sort?: "created_at_asc" | "created_at_desc" | "due_at_asc"
  origin?: "manual" | "ai"
}

// 15. /cards GET pagination metadata
export interface PaginationDTO {
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

// 16. /cards GET 200 response
export interface ListCardsResponseDTO {
  data: CardDTO[]
  pagination: PaginationDTO
}

// 17. /cards/{id} GET 200 response
export type GetCardResponseDTO = CardDTO

// 18. /cards/{id} PATCH command (text fields only)
export interface UpdateCardCommand {
  front?: string
  back?: string
  source_snippet?: string
}

// 19. /cards/{id} PATCH 200 response
export type UpdateCardResponseDTO = CardDTO

// 20. /cards/{id} DELETE 204 – no body DTO necessary

/**
 * AI GENERATION
 * ------------------------------------------------------------------
 */

// 21. /ai/generate POST command
export interface GenerateCardsCommand {
  input_text: string
}

// 22. AI-generated card proposal (not yet persisted)
export interface AICardProposalDTO {
  front: string
  back: string
  source_snippet: string
}

// 23. /ai/generate POST 200 response
export interface GenerateCardsResponseDTO {
  cards: AICardProposalDTO[]
  model: string
  tokens_used: {
    prompt: number
    completion: number
  }
}

// 24. /ai/cards/batch POST command
export interface SaveAICardsBatchCommand {
  cards: AICardProposalDTO[]
}

// 25. /ai/cards/batch POST 201 response
export interface SaveAICardsBatchResponseDTO {
  cards: CardDTO[]
}

/**
 * STUDY / SM-2
 * ------------------------------------------------------------------
 */

// 26. /study/due-cards GET query model
export interface GetDueCardsQuery {
  limit?: number
  from_now?: ISODateString
}

// For study we only need a subset of card fields
export type StudyCardDTO = Pick<
  CardRow,
  | "id"
  | "front"
  | "back"
  | "source_snippet"
  | "ease_factor"
  | "interval_days"
  | "repetitions"
  | "due_at"
  | "last_reviewed_at"
>

// 27. /study/due-cards 200 response
export interface GetDueCardsResponseDTO {
  cards: StudyCardDTO[]
}

// 28. /study/review POST command
export interface SubmitReviewCommand {
  card_id: string
  grade: number // validated to be integer in [0, 5]
}

// 29. /study/review 200 response
export interface SubmitReviewResponseDTO {
  card: Pick<
    CardRow,
    "id" | "ease_factor" | "interval_days" | "repetitions" | "due_at" | "last_reviewed_at"
  >
}

/**
 * HEALTH
 * ------------------------------------------------------------------
 */

// 30. /health GET 200 response
export interface HealthResponseDTO {
  status: "ok"
  timestamp: ISODateString
}
