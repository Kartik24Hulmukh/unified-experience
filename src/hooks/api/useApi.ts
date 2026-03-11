/**
 * BErozgar — React Query Hooks
 *
 * Typed hooks wrapping every API endpoint.
 * All data-fetching goes through these hooks — pages never call
 * api-client directly.
 *
 * Uses @tanstack/react-query v5 for caching, deduplication,
 * background refetch, and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import api, { type ApiResponse, ApiError } from '@/lib/api-client';
import { env } from '@/lib/env';
import type { User, UserRole, AdminPrivilegeLevel } from '@/contexts/AuthContext';

/* ═══════════════════════════════════════════════════
   Query Key Factory (keeps keys consistent & DRY)
   ═══════════════════════════════════════════════════ */

export const queryKeys = {
  // Auth
  me: ['auth', 'me'] as const,

  // Profile
  profile: ['profile'] as const,

  // Listings
  listings: {
    all: ['listings'] as const,
    module: (mod: string) => ['listings', mod] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
    search: (mod: string, search: string) => ['listings', mod, 'search', search] as const,
  },

  // Admin
  admin: {
    pending: ['admin', 'pending'] as const,
    stats: ['admin', 'stats'] as const,
    user: (userId: string) => ['admin', 'user', userId] as const,
  },

  // Disputes
  disputes: {
    all: ['disputes'] as const,
    detail: (id: string) => ['disputes', 'detail', id] as const,
  },

  // Requests (exchange lifecycle)
  requests: {
    all: ['requests'] as const,
    role: (role: 'buyer' | 'seller') => ['requests', role] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
  },

  // Admin extras
  adminAudit: ['admin', 'audit'] as const,
  adminFraud: ['admin', 'fraud'] as const,
} as const;

/* ═══════════════════════════════════════════════════
   Shared Types
   ═══════════════════════════════════════════════════ */

export interface Listing {
  id: string;
  title: string;
  price: string;
  category: string;
  module: string;
  // status reflects the Prisma ListingStatus enum — always UPPERCASE from the server
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'INTEREST_RECEIVED' | 'IN_TRANSACTION' | 'COMPLETED' | 'EXPIRED' | 'FLAGGED' | 'ARCHIVED' | 'REMOVED';
  createdBy?: string;
  createdAt: string;
  description?: string;
  owner?: { id: string; fullName: string; email: string };
}

export interface ListingFilters {
  module?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface ProfileIdentity {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  privilegeLevel?: AdminPrivilegeLevel;
  joinedAt: string;
  avatarUrl: string | null;
}

export interface StudentData {
  listingsCount: number;
  requestsCount: number;
  exchangesCompleted: number;
  valueCirculated: number;
  activeListings: number;
  reputation: number;
  cancelledRequests: number;
  disputesCount: number;
  adminFlags: number;
}

export interface AdminData {
  totalListings: number;
  activeUsers: number;
  openDisputes: number;
  avgApprovalTimeHours: number;
  recentActions: number;
  systemHealthScore: number;
  totalStudents: number;
  activeExchanges: number;
  academicListings: number;
  systemUptimePercent: number;
}

export interface TrustInfo {
  status: 'GOOD_STANDING' | 'REVIEW_REQUIRED' | 'RESTRICTED';
  reasons: string[];
}

export interface ProfileResponse {
  identity: ProfileIdentity;
  data: StudentData | AdminData;
  trust?: TrustInfo;
}

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  pendingListings: number;
  activeDisputes: number;
  totalRequests: number;
  completedExchanges: number;
}

export interface AdminRecoveryResult {
  expiredRequests: number;
  recoveredListings: number;
  revokedTokens: number;
  deletedIdempotencyKeys: number;
  recoveredAt: string;
}

export interface PendingItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  price: string;
  status: string;
  createdAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface Dispute {
  id: string;
  type: 'fraud' | 'item_not_as_described' | 'no_show' | 'other';
  // status reflects the Prisma DisputeStatus enum — always UPPERCASE from the server
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'ESCALATED';
  raisedById: string;
  againstId: string;
  requestId?: string;
  listingId?: string;
  description: string;
  createdAt: string;
}

export interface AuthUserResponse {
  user: User;
}

export interface AuthLoginResponse {
  user: User;
  accessToken: string;
  // refreshToken is sent as httpOnly cookie, not in response body
}

/* ═══════════════════════════════════════════════════
   Auth Hooks
   ═══════════════════════════════════════════════════ */

export function useCurrentUser(
  options?: Partial<UseQueryOptions<AuthUserResponse, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<AuthUserResponse>('/auth/me'),
    staleTime: env.VITE_QUERY_STALE_TIME_MS, // from env
    retry: false, // Don't retry auth checks
    ...options,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post<AuthLoginResponse>('/auth/login', credentials, { skipAuth: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, { user: data.user });
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (data: { fullName: string; email: string; password: string }) =>
      api.post<{ message: string }>('/auth/signup', data, { skipAuth: true }),
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; fullName: string; password: string; otp: string }) =>
      api.post<AuthLoginResponse>('/auth/verify-otp', data, { skipAuth: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, { user: data.user });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post('/auth/logout', undefined, { skipAuth: true }),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

/* ═══════════════════════════════════════════════════
   Profile Hooks
   ═══════════════════════════════════════════════════ */

export function useProfile(
  options?: Partial<UseQueryOptions<ApiResponse<ProfileResponse>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api.get<ApiResponse<ProfileResponse>>('/profile'),
    staleTime: 60_000, // V3-13: 1 min — trust/restriction status changes must be reflected quickly
    ...options,
  });
}

/* ═══════════════════════════════════════════════════
   Listings Hooks
   ═══════════════════════════════════════════════════ */

export function useListings(
  filters: ListingFilters = {},
  options?: Partial<UseQueryOptions<ApiResponse<Listing[]>, ApiError>>,
) {
  const params = new URLSearchParams();
  if (filters.module) params.set('module', filters.module);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.perPage) params.set('perPage', String(filters.perPage));

  const queryString = params.toString();
  const endpoint = `/listings${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: filters.search
      ? queryKeys.listings.search(filters.module || 'all', filters.search)
      : filters.module
        ? queryKeys.listings.module(filters.module)
        : queryKeys.listings.all,
    queryFn: () => api.get<ApiResponse<Listing[]>>(endpoint),
    staleTime: 2 * 60 * 1000, // Listings change more often
    ...options,
  });
}

export function useListing(
  id: string,
  options?: Partial<UseQueryOptions<ApiResponse<Listing>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.listings.detail(id),
    queryFn: () => api.get<ApiResponse<Listing>>(`/listings/${id}`),
    enabled: !!id,
    ...options,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      price: string;
      category: string;
      module: string;
      description?: string;
      idempotencyKey?: string;
    }) => {
      const { idempotencyKey, ...body } = data;
      return api.post<ApiResponse<Listing>>('/listings', body, {
        headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {},
      });
    },
    onSuccess: () => {
      // Invalidate all listing queries to refresh (including module-filtered caches)
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      queryClient.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });
}

export function useUpdateListingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<ApiResponse<Listing>>(`/listings/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.listings.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.pending });

      // Snapshot previous state for rollback
      const previousListings = queryClient.getQueryData(queryKeys.listings.all);
      const previousPending = queryClient.getQueryData(queryKeys.admin.pending);

      // Optimistically update the listing status in cache
      queryClient.setQueriesData<ApiResponse<Listing[]>>(
        { queryKey: queryKeys.listings.all },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((l) =>
              l.id === id ? { ...l, status: status as Listing['status'] } : l,
            ),
          };
        },
      );

      return { previousListings, previousPending };
    },
    onError: (_err, _vars, context) => {
      // Rollback to snapshot on failure
      if (context?.previousListings) {
        queryClient.setQueryData(queryKeys.listings.all, context.previousListings);
      }
      if (context?.previousPending) {
        queryClient.setQueryData(queryKeys.admin.pending, context.previousPending);
      }
    },
    onSettled: () => {
      // Always refetch to ensure server state consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pending });
      // V3-09: also bust module-filtered and search-filtered listing caches
      queryClient.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });
}

/* ═══════════════════════════════════════════════════
   Admin Hooks
   ═══════════════════════════════════════════════════ */

export function useAdminPending(
  options?: Partial<UseQueryOptions<ApiResponse<PendingItem[]>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.admin.pending,
    queryFn: () => api.get<ApiResponse<PendingItem[]>>('/admin/pending'),
    staleTime: 60_000, // 1 min — admin data refreshes more often
    ...options,
  });
}

export function useAdminStats(
  options?: Partial<UseQueryOptions<ApiResponse<AdminStats>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: () => api.get<ApiResponse<AdminStats>>('/admin/stats'),
    staleTime: 60_000,
    ...options,
  });
}

export function useAdminRecovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<ApiResponse<AdminRecoveryResult>>('/admin/recovery'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pending });
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

export function useAdminUserProfile(
  userId: string,
  options?: Partial<UseQueryOptions<ApiResponse<AdminUserDrilldown>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.admin.user(userId),
    queryFn: () => api.get<ApiResponse<AdminUserDrilldown>>(`/admin/users/${userId}`),
    enabled: !!userId,
    ...options,
  });
}

/* ═══════════════════════════════════════════════════
   Dispute Hooks
   ═══════════════════════════════════════════════════ */

export function useDisputes(
  options?: Partial<UseQueryOptions<ApiResponse<Dispute[]>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.disputes.all,
    queryFn: () => api.get<ApiResponse<Dispute[]>>('/disputes'),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      type: string;
      againstId: string;
      requestId?: string;
      listingId?: string;
      description: string;
    }) => api.post<ApiResponse<Dispute>>('/disputes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.disputes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminFraud });
    },
  });
}

export function useUpdateDisputeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<ApiResponse<Dispute>>(`/disputes/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.disputes.all });
      const previousDisputes = queryClient.getQueryData(queryKeys.disputes.all);

      queryClient.setQueriesData<ApiResponse<Dispute[]>>(
        { queryKey: queryKeys.disputes.all },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((d) =>
              d.id === id ? { ...d, status: status as Dispute['status'], updatedAt: new Date().toISOString() } : d,
            ),
          };
        },
      );

      return { previousDisputes };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDisputes) {
        queryClient.setQueryData(queryKeys.disputes.all, context.previousDisputes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.disputes.all });
    },
  });
}

/* ═══════════════════════════════════════════════════
   Request / Exchange Hooks
   ═══════════════════════════════════════════════════ */

export interface ExchangeRequest {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  // status reflects the Prisma RequestStatus enum — always UPPERCASE from the server
  status: 'IDLE' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'MEETING_SCHEDULED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED' | 'WITHDRAWN' | 'DISPUTED' | 'RESOLVED';
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export function useRequests(
  filters?: { role?: 'buyer' | 'seller'; status?: string },
  options?: Partial<UseQueryOptions<ApiResponse<ExchangeRequest[]>, ApiError>>,
) {
  const params = new URLSearchParams();
  if (filters?.role) params.set('role', filters.role);
  if (filters?.status) params.set('status', filters.status);
  const queryString = params.toString();
  const endpoint = `/requests${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: filters?.role ? queryKeys.requests.role(filters.role) : queryKeys.requests.all,
    queryFn: () => api.get<ApiResponse<ExchangeRequest[]>>(endpoint),
    staleTime: 60_000,
    ...options,
  });
}

export function useRequest(
  id: string,
  options?: Partial<UseQueryOptions<ApiResponse<ExchangeRequest>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: () => api.get<ApiResponse<ExchangeRequest>>(`/requests/${id}`),
    enabled: !!id,
    ...options,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { listingId: string; message?: string }) =>
      api.post<ApiResponse<ExchangeRequest>>('/requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      // Invalidate profile so trust scores and request counts reflect the new exchange
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useUpdateRequestEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, event, idempotencyKey }: { id: string; event: string; idempotencyKey?: string }) =>
      api.patch<ApiResponse<ExchangeRequest>>(`/requests/${id}/event`, { event }, {
        headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {},
      }),
    onMutate: async ({ id, event }) => {
      // EXCH-UI-02: cancel BOTH list and detail queries to prevent in-flight overwrites
      await queryClient.cancelQueries({ queryKey: queryKeys.requests.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.requests.detail(id) });

      // Snapshot for rollback
      const previousRequests = queryClient.getQueryData(queryKeys.requests.all);
      const previousDetail = queryClient.getQueryData(queryKeys.requests.detail(id));

      // Optimistic status mapping (best-effort; server FSM is the authority)
      const optimisticStatusMap: Record<string, ExchangeRequest['status']> = {
        ACCEPT: 'ACCEPTED',
        DECLINE: 'DECLINED',
        SCHEDULE: 'MEETING_SCHEDULED',
        CONFIRM: 'COMPLETED',
        CANCEL: 'CANCELLED',
        WITHDRAW: 'WITHDRAWN',
        DISPUTE: 'DISPUTED',
        // EXCH-UI-01: RESOLVE was missing — admin resolve left UI stuck in 'disputed'
        RESOLVE: 'RESOLVED',
      };
      const optimisticStatus = optimisticStatusMap[event];

      if (optimisticStatus) {
        const now = new Date().toISOString();

        // Apply to list cache
        queryClient.setQueriesData<ApiResponse<ExchangeRequest[]>>(
          { queryKey: queryKeys.requests.all },
          (old) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map((r) =>
                r.id === id ? { ...r, status: optimisticStatus, updatedAt: now } : r,
              ),
            };
          },
        );

        // EXCH-UI-04: also apply to the detail cache
        queryClient.setQueryData<ApiResponse<ExchangeRequest>>(
          queryKeys.requests.detail(id),
          (old) => {
            if (!old?.data) return old;
            return { ...old, data: { ...old.data, status: optimisticStatus, updatedAt: now } };
          },
        );
      }

      return { previousRequests, previousDetail };
    },
    onError: (_err, { id }, context) => {
      // Rollback on failure — this is the key UX-state realism guarantee
      if (context?.previousRequests) {
        queryClient.setQueryData(queryKeys.requests.all, context.previousRequests);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.requests.detail(id), context.previousDetail);
      }
    },
    onSettled: (_data, _err, { id }) => {
      // Always reconcile with server state
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      // EXCH-UI-03: also invalidate the detail query
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

/* ═══════════════════════════════════════════════════
   Admin Audit + Fraud Dashboard Hooks
   ═══════════════════════════════════════════════════ */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: 'listing' | 'request' | 'dispute' | 'user' | 'system';
  targetId: string;
  details?: string;
}

export interface FraudDashboardData {
  flaggedUsers: Array<{
    userId: string;
    email: string;
    fullName: string;
    riskLevel: string;
    flags: string[];
    trust: string;
    activeDisputes: number;
  }>;
  totalFlagged: number;
  highRisk: number;
  mediumRisk: number;
}

/** Typed response for GET /admin/users/:userId (admin drilldown) */
export interface AdminUserDrilldown {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    verified: boolean;
    createdAt: string;
    completedExchanges: number;
    cancelledRequests: number;
    adminFlags: number;
    isRestricted: boolean;
  };
  trust: {
    status: 'GOOD_STANDING' | 'REVIEW_REQUIRED' | 'RESTRICTED';
    reasons: string[];
  };
  fraud: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    flags: string[];
  };
  restriction: {
    isRestricted: boolean;
    reason?: string;
  };
}

export function useAdminAuditLog(
  options?: Partial<UseQueryOptions<ApiResponse<AuditLogEntry[]>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.adminAudit,
    queryFn: () => api.get<ApiResponse<AuditLogEntry[]>>('/admin/audit'),
    staleTime: 30_000,
    ...options,
  });
}

export function useAdminFraudDashboard(
  options?: Partial<UseQueryOptions<ApiResponse<FraudDashboardData>, ApiError>>,
) {
  return useQuery({
    queryKey: queryKeys.adminFraud,
    queryFn: () => api.get<ApiResponse<FraudDashboardData>>('/admin/fraud'),
    staleTime: 60_000,
    ...options,
  });
}
