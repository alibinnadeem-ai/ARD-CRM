/**
 * hooks/useLeads.js
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { readApiResponse } from "../utils/helpers";

function getAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("ard_crm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useLeads() {
  const [records,     setRecords]     = useState([]);
  const [headers,     setHeaders]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [syncedAt,    setSyncedAt]    = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter,setStatusFilter]= useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [sortBy,      setSortBy]      = useState("created_at");
  const [sortDir,     setSortDir]     = useState("desc");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/leads", { headers: getAuthHeaders() });
      const data = await readApiResponse(res, "Failed to load leads");
      setRecords(data.records || []);
      setHeaders(data.headers || []);
      setSyncedAt(data.syncedAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 90_000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const filtered = useMemo(() => {
    let result = [...records];
    if (statusFilter !== "All") result = result.filter((r) => r.status === statusFilter);
    if (stageFilter  !== "All") result = result.filter((r) => r.stage  === stageFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const text = [r.id,r.name,r.company,r.email,r.phone,r.status,r.stage,r.source,
          r.assigned_to,r.notes,r.tags,r.city,r.value,...Object.values(r._extra||{})]
          .filter(Boolean).join(" ").toLowerCase();
        return text.includes(q);
      });
    }
    result.sort((a, b) => {
      const av = a[sortBy] || "", bv = b[sortBy] || "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [records, searchQuery, statusFilter, stageFilter, sortBy, sortDir]);

  return {
    records, filtered, headers, loading, error, syncedAt,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    stageFilter,  setStageFilter,
    sortBy, setSortBy, sortDir, setSortDir,
    refresh: fetchLeads,
  };
}

export function useSync() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncedAt,setSyncedAt]= useState(null);

  const fetchSync = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/sync", { headers: getAuthHeaders() });
      const json = await readApiResponse(res, "Failed to load dashboard data");
      setData(json);
      setSyncedAt(json.syncedAt);
    } catch (err) {
      console.error("[useSync]", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSync();
    const interval = setInterval(fetchSync, 90_000);
    return () => clearInterval(interval);
  }, [fetchSync]);

  return { data, loading, syncedAt, refresh: fetchSync };
}

export function useSingleRecord(rowIndex) {
  const [record,  setRecord]  = useState(null);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const doFetch = useCallback(async () => {
    if (!rowIndex) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/leads/${rowIndex}`, { headers: getAuthHeaders() });
      const data = await readApiResponse(res, "Failed to load lead");
      setRecord(data.record);
      setHeaders(data.headers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [rowIndex]);

  useEffect(() => { doFetch(); }, [doFetch]);
  return { record, headers, loading, error, refresh: doFetch };
}
