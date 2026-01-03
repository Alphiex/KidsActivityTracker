'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getImports, ImportBatch } from '@/lib/vendorApi';

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const limit = 20;

  useEffect(() => {
    fetchImports();
  }, [currentPage, statusFilter]);

  const fetchImports = async () => {
    setIsLoading(true);
    try {
      const response = await getImports({
        page: currentPage,
        limit,
        status: statusFilter || undefined,
      });

      setImports(response.batches || []);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      VALIDATED: 'bg-yellow-100 text-yellow-800',
      VALIDATING: 'bg-yellow-100 text-yellow-800',
      PENDING: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getApprovalBadge = (status: string) => {
    const colors: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-800',
      AUTO_APPROVED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import History</h1>
        <Link
          href="/vendor/dashboard/imports/new"
          className="px-4 py-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          New Import
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="VALIDATING">Validating</option>
            <option value="VALIDATED">Validated</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p>No imports found.</p>
            <Link
              href="/vendor/dashboard/imports/new"
              className="text-[#E8638B] hover:text-[#D53F8C] mt-2 inline-block"
            >
              Import your first file
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rows</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Results</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {imports.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          <p className="font-medium text-gray-900 truncate">{batch.fileName}</p>
                          <p className="text-xs text-gray-500">{batch.fileType}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(batch.status)}
                      </td>
                      <td className="px-4 py-3">
                        {getApprovalBadge(batch.approvalStatus)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="text-gray-900">{batch.totalRows}</span>
                          {batch.validRows > 0 && (
                            <span className="text-gray-500"> ({batch.validRows} valid)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm space-y-1">
                          {batch.createdRows > 0 && (
                            <div className="text-green-600">+{batch.createdRows} created</div>
                          )}
                          {batch.updatedRows > 0 && (
                            <div className="text-blue-600">{batch.updatedRows} updated</div>
                          )}
                          {batch.errorRows > 0 && (
                            <div className="text-red-600">{batch.errorRows} errors</div>
                          )}
                          {batch.createdRows === 0 && batch.updatedRows === 0 && batch.errorRows === 0 && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/vendor/dashboard/imports/${batch.id}`}
                          className="text-[#E8638B] hover:text-[#C53078] text-sm"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, total)} of {total} imports
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
