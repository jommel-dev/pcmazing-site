import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../../core/config/app-config';
import { DashboardOverview, DashboardPeriod } from '../data/dashboard.types';
import { AdminAuthService } from './admin-auth.service';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

interface ItemResponse<T> {
  success: boolean;
  data: T;
}

export interface ContactInquiry {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  serviceInterest: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReview {
  id: number;
  fullName: string;
  email: string | null;
  company: string | null;
  rating: number;
  title: string | null;
  message: string;
  status: string;
  isPublished: boolean;
  publishedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoRequest {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  serviceInterest: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  status: string;
  followUpNotes: string | null;
  followedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialItem {
  id: number;
  materialCode: string | null;
  materialName: string;
  brandName: string | null;
  unit: string | null;
  unitPrice: number | null;
  sellPrice: number | null;
  onHandStock: number | null;
  reorderLevel: number | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface InventoryTreeNode {
  id: number;
  name: string;
  type: 'product-type' | 'brand';
  materialCount: number;
  children?: InventoryTreeNode[];
}

export interface QuotationListItem {
  id: number;
  quoteNo: string | null;
  quoteDate: string | null;
  customerName: string | null;
  totalAmount: number | null;
  status: string | null;
  expiresAt: string | null;
  convertedSalesId: number | null;
  createdAt: string | null;
}

export interface QuotationDetail extends QuotationListItem {
  customerAddress?: string | null;
  customerContactPerson?: string | null;
  customerContactNumber?: string | null;
  customerEmail?: string | null;
  validityDays?: number | null;
  remarks?: string | null;
  items: Array<{
    id: number;
    materialId: number | null;
    productId: number | null;
    unitPrice: number | null;
    sellPrice: number | null;
    discountPrice: number | null;
    totalSetQty: number | null;
    lineTotal: number | null;
    remarks: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminAuth = inject(AdminAuthService);

  listContactInquiries(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<ContactInquiry>>(
      `${APP_CONFIG.apiUrl}/admin/contact-inquiries`,
      { headers: this.headers(), params },
    );
  }

  getContactInquiry(id: number) {
    return this.http.get<ItemResponse<ContactInquiry>>(
      `${APP_CONFIG.apiUrl}/admin/contact-inquiries/${id}`,
      { headers: this.headers() },
    );
  }

  updateContactInquiry(id: number, payload: { status?: string; adminNotes?: string }) {
    return this.http.patch<ItemResponse<ContactInquiry>>(
      `${APP_CONFIG.apiUrl}/admin/contact-inquiries/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  listCustomerReviews(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<CustomerReview>>(
      `${APP_CONFIG.apiUrl}/admin/customer-reviews`,
      { headers: this.headers(), params },
    );
  }

  getCustomerReview(id: number) {
    return this.http.get<ItemResponse<CustomerReview>>(
      `${APP_CONFIG.apiUrl}/admin/customer-reviews/${id}`,
      { headers: this.headers() },
    );
  }

  updateCustomerReview(
    id: number,
    payload: { status?: string; isPublished?: boolean; adminNotes?: string },
  ) {
    return this.http.patch<ItemResponse<CustomerReview>>(
      `${APP_CONFIG.apiUrl}/admin/customer-reviews/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  listDemoRequests(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<DemoRequest>>(
      `${APP_CONFIG.apiUrl}/admin/demo-requests`,
      { headers: this.headers(), params },
    );
  }

  getDemoRequest(id: number) {
    return this.http.get<ItemResponse<DemoRequest>>(
      `${APP_CONFIG.apiUrl}/admin/demo-requests/${id}`,
      { headers: this.headers() },
    );
  }

  updateDemoRequest(id: number, payload: { status?: string; followUpNotes?: string }) {
    return this.http.patch<ItemResponse<DemoRequest>>(
      `${APP_CONFIG.apiUrl}/admin/demo-requests/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  listMaterials(page = 1, limit = 20, search = '', brandId?: number, productTypeId?: number) {
    let params = this.listParams(page, limit, search);
    if (brandId) {
      params = params.set('brandId', String(brandId));
    }
    if (productTypeId) {
      params = params.set('productTypeId', String(productTypeId));
    }

    return this.http.get<ListResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials`,
      { headers: this.headers(), params },
    );
  }

  getMaterial(id: number) {
    return this.http.get<ItemResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/${id}`,
      { headers: this.headers() },
    );
  }

  getInventoryTree() {
    return this.http.get<{ success: boolean; data: InventoryTreeNode[] }>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/tree`,
      { headers: this.headers() },
    );
  }

  listQuotations(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<QuotationListItem>>(
      `${APP_CONFIG.apiUrl}/admin/quotations`,
      { headers: this.headers(), params },
    );
  }

  getQuotation(id: number) {
    return this.http.get<ItemResponse<QuotationDetail>>(
      `${APP_CONFIG.apiUrl}/admin/quotations/${id}`,
      { headers: this.headers() },
    );
  }

  getDashboardOverview(options: {
    period?: DashboardPeriod;
    startDate?: string;
    endDate?: string;
  } = {}) {
    let params = new HttpParams();

    if (options.period) {
      params = params.set('period', options.period);
    }
    if (options.startDate) {
      params = params.set('startDate', options.startDate);
    }
    if (options.endDate) {
      params = params.set('endDate', options.endDate);
    }

    return this.http.get<ItemResponse<DashboardOverview>>(
      `${APP_CONFIG.apiUrl}/admin/dashboard/overview`,
      { headers: this.headers(), params },
    );
  }

  private listParams(page: number, limit: number, search: string): HttpParams {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return params;
  }

  private headers(): HttpHeaders {
    return this.adminAuth.buildAuthHeaders();
  }
}
