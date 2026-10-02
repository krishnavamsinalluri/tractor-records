"use client";

import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  HouseDoor,
  HouseDoorFill,
  People,
  PeopleFill,
  PlusLg,
  ClockHistory,
  Gear,
  GearFill,
  TelephoneFill,
  Whatsapp,
  Search,
  ChevronRight,
  ArrowLeft,
  PencilSquare,
  CheckCircleFill,
  CashCoin,
  Wallet2,
  BoxArrowRight,
  KeyFill,
  EyeFill,
  EyeSlashFill,
  X,
  Dash,
  Plus,
  Translate,
  Sliders,
  PersonFill,
  Phone,
  Truck,
  EnvelopeFill,
  LockFill,
} from "react-bootstrap-icons";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { IconButton } from "@/components/icon-button";
import {
  friendlyError,
  LanguageProvider,
  useLanguage,
  type MessageKey,
} from "@/components/language-provider";
import { WorkTypeIcon, TractorBrandIcon, getWorkTypeMeta } from "@/components/work-type-icon";
import { getPasswordRecoveryRedirectUrl, getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import type { ChargeBasis, Customer, Payment, WorkRecord, WorkType } from "@/lib/types";

type Notice = { tone: "success" | "error"; text: string } | null;
type UnsavedNavigation = { href?: string; onDiscard?: () => void };
type ContactPickerContact = { name?: string[]; tel?: string[] };
declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: ("name" | "tel")[],
        options: { multiple: boolean },
      ) => Promise<ContactPickerContact[]>;
    };
  }
}

const subscribeToContactPickerSupport = () => () => undefined;
const getContactPickerSupport = () => typeof navigator !== "undefined" && typeof navigator.contacts?.select === "function";
const getServerContactPickerSupport = () => false;
const UNSAVED_CHANGES_MESSAGE = "మార్పులను సేవ్ చేయకుండా బయటకు వెళ్లాలా?";

function recoveryParameters() {
  const query = typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
  const hash = typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (name: string) => query.get(name) ?? hash.get(name);
  return {
    error: get("error"),
    errorCode: get("error_code"),
    errorDescription: get("error_description"),
  };
}

type RecoveryLinkFailure = "expired-or-used" | "invalid";

function recoveryLinkFailure(error: string | null, errorCode: string | null, description: string | null): RecoveryLinkFailure | null {
  if (!error && !errorCode) return null;
  const errorText = `${errorCode ?? ""} ${description ?? ""}`.toLowerCase();
  if (
    errorCode === "otp_expired" ||
    errorCode === "session_expired" ||
    errorText.includes("expired") ||
    errorText.includes("already") ||
    errorText.includes("used")
  ) {
    return "expired-or-used";
  }
  return "invalid";
}

function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmBrowserBack = () => {
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        window.history.forward();
      }
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || target.getAttribute("target") === "_blank" || target.hasAttribute("download")) return;
      const destination = new URL(target.getAttribute("href") ?? "", window.location.href);
      if (destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent<UnsavedNavigation>("tractor-unsaved-navigation", {
        detail: { href: `${destination.pathname}${destination.search}${destination.hash}` },
      }));
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", confirmBrowserBack);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", confirmBrowserBack);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [isDirty]);

  return useCallback((close: () => void) => {
    if (!isDirty) close();
    else window.dispatchEvent(new CustomEvent<UnsavedNavigation>("tractor-unsaved-navigation", { detail: { onDiscard: close } }));
  }, [isDirty]);
}

const DEFAULT_WORK_TYPES = [
  "Cultivator / కల్టివేటర్",
  "Rotavator / రోటావేటర్",
  "Ploughing / దుక్కి",
  "Transport / రవాణా",
];

const today = () => new Date().toLocaleDateString("en-CA");
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const paidFor = (work: WorkRecord) =>
  (work.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
const balanceFor = (work: WorkRecord) => Math.max(0, Number(work.total) - paidFor(work));
const displayWorkType = (name: string, language: "te" | "en") => {
  if (language !== "te") return name;
  const parts = name.split("/").map((part) => part.trim());
  if (parts.length === 2 && /[A-Za-z]/.test(parts[0]) && /[\u0C00-\u0C7F]/.test(parts[1])) {
    return `${parts[1]} / ${parts[0]}`;
  }
  return name;
};
const configuredRate = (workType: WorkType | undefined, basis: ChargeBasis) => {
  const value = basis === "acre" ? workType?.acre_rate : workType?.hour_rate;
  return value == null ? "" : String(value);
};
const paymentStatus = (balance: number) => balance > 0
  ? `చెల్లించాల్సిన బాకీ: ${money(balance)}\n\nPhonePe / Google Pay ద్వారా\n9704200894 నంబర్‌కు చెల్లించండి.\nచెల్లించే ముందు పేరు సరిచూసుకోండి.`
  : "బాకీ లేదు — మొత్తం చెల్లించారు.";

function FieldLabel({ label }: { label: string }) {
  return <span className="field-label"><b>{label}</b></span>;
}

function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <button
      type="button"
      className={`language-toggle${compact ? " compact" : ""}`}
      onClick={() => setLanguage(language === "te" ? "en" : "te")}
      aria-label={t("languageLabel")}
      title={t("languageLabel")}
    >
      <Translate size={18} />
      <span>{t("language")}</span>
    </button>
  );
}

function WorkflowPage({ children }: { children: React.ReactNode }) {
  return <div className="workflow-page">{children}</div>;
}

function workflowTitle(dialog: string, t: (key: MessageKey) => string) {
  const titles: Record<string, MessageKey> = {
    "add-work": "addWork",
    "edit-work": "editWork",
    "work-saved": "workSavedTitle",
    "share-work": "shareReceiptTitle",
    "add-payment": "addPayment",
    "customer-payment": "addPayment",
    "share-all": "shareAllDetails",
    "add-customer": "addNewCustomer",
    "edit-customer": "editCustomer",
    "work-types": "workTypesAndRates",
    "add-work-type": "addWorkType",
    "edit-work-type": "editWorkType",
    profile: "settings",
    "profile-password": "changePassword",
  };
  return t(titles[dialog] ?? "settings");
}

function EmptyState({ title, text }: {
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-illustration">
        <Image
          src="/images/empty-records.png"
          alt={title}
          width={160}
          height={100}
          style={{ width: "auto", height: "auto", maxWidth: "160px" }}
        />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function TractorApp() {
  return <LanguageProvider><TractorAppContent /></LanguageProvider>;
}

function TractorAppContent() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerFilters, setCustomerFilters] = useState<Record<string, "all" | "pending" | "paid">>({});
  const [unsavedNavigation, setUnsavedNavigation] = useState<UnsavedNavigation | null>(null);
  const [savedWorkForShare, setSavedWorkForShare] = useState<WorkRecord | null>(null);
  const customerListScroll = useRef(0);
  const detailOpenedFromList = useRef(false);
  const previousPath = useRef(pathname);

  const customerMatch = pathname.match(/^\/customers\/([^/]+)/);
  const customerId = customerMatch && customerMatch[1] !== "new" ? decodeURIComponent(customerMatch[1]) : null;
  const selectedCustomer = customerId ? customers.find((customer) => customer.id === customerId) : undefined;
  const isCustomerDetail = Boolean(customerId && pathname === `/customers/${encodeURIComponent(customerId)}`);

  // Determine active view
  const view = isCustomerDetail || pathname === "/customers"
    ? "customers"
    : pathname === "/pending"
      ? "pending"
      : pathname === "/settings" || pathname === "/work-types"
        ? "settings"
        : "dashboard";

  const workRoute = pathname.match(/^\/work\/([^/]+)(?:\/(edit|share))?$/);
  const savedWorkRoute = pathname.match(/^\/work\/saved\/([^/]+)$/);
  const paymentRoute = pathname.match(/^\/payments\/work\/([^/]+)$/);
  const customerPaymentRoute = pathname.match(/^\/customers\/([^/]+)\/payment$/);
  const customerShareRoute = pathname.match(/^\/customers\/([^/]+)\/share$/);
  const customerEditRoute = pathname.match(/^\/customers\/([^/]+)\/edit$/);
  const workTypeEditRoute = pathname.match(/^\/work-types\/([^/]+)\/edit$/);
  const dialog = pathname === "/work/new" ? "add-work"
    : workRoute?.[2] === "edit" ? "edit-work"
      : workRoute?.[2] === "share" ? "share-work"
        : savedWorkRoute ? "work-saved"
          : paymentRoute ? "add-payment"
            : pathname === "/customers/new" ? "add-customer"
              : customerPaymentRoute ? "customer-payment"
                : customerShareRoute ? "share-all"
                  : customerEditRoute ? "edit-customer"
                  : pathname === "/work-types" ? "work-types"
                    : pathname === "/work-types/new" ? "add-work-type"
                      : workTypeEditRoute ? "edit-work-type"
                        : pathname === "/profile" ? "profile"
                          : pathname === "/profile/password" ? "profile-password"
                          : null;
  const dialogWorkId = (workRoute?.[2] ? workRoute[1] : undefined) ?? savedWorkRoute?.[1] ?? paymentRoute?.[1];
  const workTypeId = workTypeEditRoute?.[1];
  const dialogWork = works.find((work) => work.id === dialogWorkId) ??
    (savedWorkForShare?.id === dialogWorkId ? savedWorkForShare : undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const [customerResult, typeResult, workResult] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("work_types").select("*").order("name"),
      supabase
        .from("work_records")
        .select("*, customer:customers(*), payments(*)")
        .order("work_date", { ascending: false }),
    ]);
    const error = customerResult.error ?? typeResult.error ?? workResult.error;

    if (error) {
      setNotice({ tone: "error", text: friendlyError(error.message, t) });
    } else {
      let availableWorkTypes = (typeResult.data ?? []) as WorkType[];
      if (availableWorkTypes.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const userId = userData.user.id;
          const { data: seededTypes, error: seedError } = await supabase
            .from("work_types")
            .insert(DEFAULT_WORK_TYPES.map((name) => ({ user_id: userId, name })))
            .select();
          if (seedError) {
            setNotice({ tone: "error", text: friendlyError(seedError.message, t) });
          } else {
            availableWorkTypes = (seededTypes ?? []) as WorkType[];
          }
        }
      }
      setCustomers((customerResult.data ?? []) as Customer[]);
      setWorkTypes(availableWorkTypes);
      setWorks((workResult.data ?? []) as unknown as WorkRecord[]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const supabase = getSupabase();
    let active = true;
    let initialCheckComplete = false;

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(Boolean(nextSession));
        setSession(nextSession);
        return;
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setPasswordRecovery(false);
      if (!initialCheckComplete || event === "INITIAL_SESSION") return;
      setSession(nextSession);
      setAuthLoading(false);
    });

    const checkExistingSession = async () => {
      let validSession: Session | null = null;
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        validSession = sessionError ? null : sessionData.session;

        if (validSession) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData.user) {
            validSession = null;
            await supabase.auth.signOut({ scope: "local" });
          }
        }
      } catch {
        validSession = null;
      }

      initialCheckComplete = true;
      if (active) {
        setSession(validSession);
        setAuthLoading(false);
      }
    };

    void checkExistingSession();
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (pathname === "/reset-password" || pathname === "/forgot-password") return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [session, loadData, pathname]);

  useEffect(() => {
    if (authLoading || session || !hasSupabaseConfig) return;
    if (pathname === "/" || pathname === "/forgot-password" || pathname === "/reset-password") return;
    router.replace("/");
  }, [authLoading, pathname, router, session]);

  useEffect(() => {
    if (pathname === "/customers" && previousPath.current.startsWith("/customers/")) {
      const scrollTop = customerListScroll.current;
      detailOpenedFromList.current = false;
      window.requestAnimationFrame(() => window.scrollTo(0, scrollTop));
    }
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const showWarning = (event: Event) => setUnsavedNavigation((event as CustomEvent<UnsavedNavigation>).detail);
    window.addEventListener("tractor-unsaved-navigation", showWarning);
    return () => window.removeEventListener("tractor-unsaved-navigation", showWarning);
  }, []);

  const totals = useMemo(() => works.reduce((acc, work) => {
    acc.total += Number(work.total);
    acc.received += paidFor(work);
    return acc;
  }, { total: 0, received: 0 }), [works]);

  if (authLoading) return (
    <div className="center-screen" role="status" aria-live="polite">
      <div className="spinner" />
      <p>{t("checkingSession")}</p>
    </div>
  );
  if (!hasSupabaseConfig) return <SetupRequired />;
  if (pathname === "/forgot-password") return <ForgotPassword />;
  if (pathname === "/reset-password") return <ResetPassword hasRecoverySession={Boolean(session) && passwordRecovery} />;
  if (!session) return <Login />;

  const currentLocation = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const workflowUrl = (path: string, from = currentLocation) => {
    const params = new URLSearchParams({ from });
    return `${path}?${params.toString()}`;
  };
  const openDialog = (name: string, itemId?: string) => {
    const paths: Record<string, string> = {
      "add-customer": "/customers/new",
      "work-types": "/work-types",
      "customer-payment": customerId ? `/customers/${encodeURIComponent(customerId)}/payment` : "/customers",
      "share-all": customerId ? `/customers/${encodeURIComponent(customerId)}/share` : "/customers",
    };
    const path = name === "add-work" ? "/work/new"
      : name === "edit-work" ? `/work/${encodeURIComponent(itemId ?? "")}/edit`
        : name === "share-work" ? `/work/${encodeURIComponent(itemId ?? "")}/share`
          : name === "add-payment" ? `/payments/work/${encodeURIComponent(itemId ?? "")}`
            : name === "edit-customer" ? `/customers/${encodeURIComponent(itemId ?? "")}/edit`
              : paths[name];
    if (path) router.push(workflowUrl(path), { scroll: false });
  };
  const openNewWork = (forCustomerId?: string) => {
    const path = "/work/new";
    const params = new URLSearchParams({ from: currentLocation });
    if (forCustomerId) params.set("customerId", forCustomerId);
    router.push(`${path}?${params.toString()}`, { scroll: false });
  };
  const openEditWork = (work: WorkRecord) => {
    openDialog("edit-work", work.id);
  };
  const openShareWork = (work: WorkRecord) => openDialog("share-work", work.id);
  const closeDialog = () => {
    const from = searchParams.get("from");
    const safeFrom = from?.startsWith("/") && !from.startsWith("//") ? from : null;
    const fallback = customerId ? `/customers/${encodeURIComponent(customerId)}` : "/";
    router.replace(safeFrom ?? fallback, { scroll: false });
  };
  const openCustomer = (customer: Customer) => {
    customerListScroll.current = window.scrollY;
    detailOpenedFromList.current = true;
    router.push(`/customers/${encodeURIComponent(customer.id)}`);
  };
  const goBackFromCustomer = () => {
    if (detailOpenedFromList.current) {
      detailOpenedFromList.current = false;
      router.back();
    } else {
      router.replace("/customers");
    }
  };
  const signOut = async () => {
    await getSupabase().auth.signOut({ scope: "local" });
    setSession(null);
    setPasswordRecovery(false);
    setNotice(null);
    setCustomerQuery("");
    setSavedWorkForShare(null);
    customerListScroll.current = 0;
    detailOpenedFromList.current = false;
    router.replace("/");
  };

  return (
    <div className={isCustomerDetail || dialog ? "app-shell" : "app-shell has-bottom-nav"}>
      <header className={`topbar${dialog ? " workflow-topbar" : ""}`}>
        {dialog ? (
          <>
            <Link className="workflow-back" href={searchParams.get("from")?.startsWith("/") && !searchParams.get("from")?.startsWith("//") ? searchParams.get("from")! : customerId ? `/customers/${encodeURIComponent(customerId)}` : "/"} aria-label={t("back")}>
              <ArrowLeft size={22} />
            </Link>
            <h1>{workflowTitle(dialog, t)}</h1>
            <LanguageToggle compact />
          </>
        ) : <>
        <div className="brand">
          <span className="brand-mark"><TractorBrandIcon size={28} color="#ffffff" /></span>
          <div className="brand-text">
            <strong>{t("appName")}</strong>
            <small>{t("greeting")}</small>
          </div>
        </div>
        <div className="topbar-actions">
          <LanguageToggle compact />
          <IconButton icon={BoxArrowRight} label={t("signOut")} onClick={() => void signOut()} />
        </div>
        </>}
      </header>

      {notice && (
        <button className={`notice ${notice.tone}`} onClick={() => setNotice(null)}>
          <span>{notice.text}</span><X size={20} />
        </button>
      )}

      {unsavedNavigation && (
        <aside className="unsaved-warning" role="alert">
          <span>{t("unsavedChangesPrompt")}</span>
          <div>
            <button type="button" onClick={() => setUnsavedNavigation(null)}>{t("continueEditing")}</button>
            <button type="button" className="discard-button" onClick={() => {
              const pending = unsavedNavigation;
              setUnsavedNavigation(null);
              if (pending.onDiscard) pending.onDiscard();
              else if (pending.href) router.push(pending.href, { scroll: false });
            }}>{t("discardChanges")}</button>
          </div>
        </aside>
      )}

      <main className="main-content">
        {dialog ? (
          <WorkflowPage>
            {(dialog === "add-work" || (dialog === "edit-work" && dialogWork)) && (
              <WorkModal
                customers={customers}
                workTypes={workTypes}
                work={dialog === "edit-work" ? dialogWork ?? undefined : undefined}
                initialCustomerId={searchParams.get("customerId") ?? undefined}
                userId={session.user.id}
                onClose={closeDialog}
                onSaved={(saved) => {
                  setSavedWorkForShare(saved);
                  void loadData();
                  router.replace(workflowUrl(`/work/saved/${encodeURIComponent(saved.id)}`, searchParams.get("from") ?? "/"), { scroll: false });
                }}
                setNotice={setNotice}
                onCustomerCreated={(newCust) => setCustomers((prev) => [...prev, newCust])}
              />
            )}
            {dialog === "work-saved" && dialogWork && (
              <WorkSavedModal
                work={dialogWork}
                onClose={closeDialog}
                onGoToCustomer={() => router.replace(`/customers/${encodeURIComponent(dialogWork.customer_id)}`)}
                onShare={() => router.push(workflowUrl(`/work/${encodeURIComponent(dialogWork.id)}/share`), { scroll: false })}
              />
            )}
            {dialog === "share-work" && dialogWork && <ShareSheet work={dialogWork} onClose={closeDialog} />}
            {dialog === "add-payment" && dialogWork && (
              <PaymentModal work={dialogWork} onClose={closeDialog} onSaved={() => { void loadData(); closeDialog(); }} setNotice={setNotice} />
            )}
            {dialog === "customer-payment" && selectedCustomer && (
              <CustomerPaymentModal
                customer={selectedCustomer}
                works={works.filter((work) => work.customer_id === selectedCustomer.id)}
                onClose={closeDialog}
                onSaved={() => { void loadData(); closeDialog(); }}
                setNotice={setNotice}
              />
            )}
            {dialog === "share-all" && selectedCustomer && (
              <CustomerShareSheet customer={selectedCustomer} works={works.filter((work) => work.customer_id === selectedCustomer.id)} onClose={closeDialog} />
            )}
            {dialog === "add-customer" && (
              <NewCustomerModal
                userId={session.user.id}
                onClose={closeDialog}
                onSaved={(newCustomer) => {
                  setCustomers((prev) => [...prev, newCustomer]);
                  router.replace(`/customers/${encodeURIComponent(newCustomer.id)}`);
                }}
                setNotice={setNotice}
              />
            )}
            {dialog === "edit-customer" && selectedCustomer && (
              <NewCustomerModal
                userId={session.user.id}
                customer={selectedCustomer}
                onClose={closeDialog}
                onSaved={() => { void loadData(); closeDialog(); }}
                setNotice={setNotice}
              />
            )}
            {dialog === "work-types" && (
              <WorkTypeSettings workTypes={workTypes} onRefresh={loadData} setNotice={setNotice} onAdd={() => router.push(workflowUrl("/work-types/new"), { scroll: false })} onEdit={(type) => router.push(workflowUrl(`/work-types/${encodeURIComponent(type.id)}/edit`), { scroll: false })} />
            )}
            {(dialog === "add-work-type" || dialog === "edit-work-type") && (
              <div className="workflow-panel"><WorkTypeForm workType={workTypes.find((type) => type.id === workTypeId)} onSaved={async () => { await loadData(); closeDialog(); }} setNotice={setNotice} /></div>
            )}
            {dialog === "profile" && (
              <SettingsView session={session} workTypes={workTypes} onSignOut={() => void signOut()} onOpenWorkTypes={() => router.push(workflowUrl("/work-types"), { scroll: false })} onChangePassword={() => router.push(workflowUrl("/profile/password"), { scroll: false })} />
            )}
            {dialog === "profile-password" && <div className="workflow-panel"><ChangePasswordPanel /></div>}
            {dialog && !["add-work", "edit-work", "work-saved", "share-work", "add-payment", "customer-payment", "share-all", "add-customer", "edit-customer", "work-types", "add-work-type", "edit-work-type", "profile", "profile-password"].includes(dialog) && (
              <div className="center-screen" role="status"><div className="spinner" /><p>{t("loading")}</p></div>
            )}
            {dialogWorkId && !dialogWork && loading && <div className="loading-line" role="status">{t("loading")}</div>}
          </WorkflowPage>
        ) : <>
        {isCustomerDetail && selectedCustomer ? (
          <CustomerDetail
            customer={selectedCustomer}
            works={works.filter((work) => work.customer_id === selectedCustomer.id)}
            filter={customerFilters[selectedCustomer.id] ?? "all"}
            onFilterChange={(filter) => setCustomerFilters((current) => ({ ...current, [selectedCustomer.id]: filter }))}
            onBack={goBackFromCustomer}
            onAddWork={() => openNewWork(selectedCustomer.id)}
            onEditCustomer={() => openDialog("edit-customer", selectedCustomer.id)}
            onEdit={openEditWork}
            onShare={openShareWork}
            onAddPayment={(work) => openDialog("add-payment", work.id)}
            onAddCustomerPayment={() => openDialog("customer-payment")}
            onShareAll={() => openDialog("share-all")}
          />
        ) : isCustomerDetail ? (
          loading ? (
            <div className="center-screen"><div className="spinner" /><p>{t("loading")}</p></div>
          ) : (
            <>
              <button className="back-button" onClick={goBackFromCustomer}>
                <ArrowLeft size={20} /> {t("back")}
              </button>
              <EmptyState title={t("noFarmers")} text={t("noFarmersHelp")} />
            </>
          )
        ) : view === "dashboard" ? (
          <Dashboard
            customers={customers}
            works={works}
            total={totals.total}
            received={totals.received}
            loading={loading}
            onAdd={() => openNewWork()}
            onOpenCustomer={openCustomer}
            onViewAllDues={() => router.push("/pending")}
          />
        ) : view === "customers" ? (
          <Customers
            customers={customers}
            works={works}
            query={customerQuery}
            onQueryChange={setCustomerQuery}
            onSelect={openCustomer}
            onAddNewCustomer={() => openDialog("add-customer")}
          />
        ) : view === "pending" ? (
          <PendingDuesView
            customers={customers}
            works={works}
            onSelect={openCustomer}
          />
        ) : (
          <SettingsView
            session={session}
            workTypes={workTypes}
            onSignOut={() => void signOut()}
            onOpenWorkTypes={() => openDialog("work-types")}
            onChangePassword={() => router.push(workflowUrl("/profile/password"), { scroll: false })}
          />
        )}
        </>}
      </main>

      {/* Floating Bottom Navigation */}
      {!isCustomerDetail && !dialog && (
        <nav className="bottom-nav" aria-label={t("appSubtitle")}>
          <Link className={view === "dashboard" ? "active" : ""} href="/">
            {view === "dashboard" ? <HouseDoorFill size={22} /> : <HouseDoor size={22} />}
            <span>{t("navHome")}</span>
          </Link>
          <Link className={view === "customers" ? "active" : ""} href="/customers">
            {view === "customers" ? <PeopleFill size={22} /> : <People size={22} />}
            <span>{t("navCustomers")}</span>
          </Link>
          {/* Prominent Add Work Button */}
          <button
            type="button"
            className="bottom-nav-action"
            onClick={() => openNewWork()}
            aria-label={t("addWork")}
            title={t("addWork")}
          >
            <div className="action-circle">
              <PlusLg size={24} />
            </div>
            <span>{t("navWork")}</span>
          </button>
          <Link className={view === "pending" ? "active" : ""} href="/pending">
            <ClockHistory size={22} />
            <span>{t("navPending")}</span>
          </Link>
          <Link className={view === "settings" ? "active" : ""} href="/settings">
            {view === "settings" ? <GearFill size={22} /> : <Gear size={22} />}
            <span>{t("navSettings")}</span>
          </Link>
        </nav>
      )}

    </div>
  );
}

function SetupRequired() {
  const { t } = useLanguage();
  return (
    <div className="setup-screen">
      <div className="setup-toolbar"><LanguageToggle /></div>
      <div className="setup-icon"><TractorBrandIcon size={44} color="#15803d" /></div>
      <p className="eyebrow">{t("setupOnce")}</p>
      <h1>{t("setupTitle")}</h1>
      <p>{t("setupHelp")}</p>
      <pre>NEXT_PUBLIC_SUPABASE_URL=...{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=...</pre>
      <p className="muted">{t("setupDocs")}</p>
    </div>
  );
}

// -------------------------------------------------------------
// LOGIN SCREEN (Matching Reference Screen 1)
// -------------------------------------------------------------
function Login() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await getSupabase().auth.signInWithPassword({ email, password });
    if (authError) {
      setError(friendlyError(authError.message, t));
      setBusy(false);
    } else {
      router.replace("/");
    }
  };

  return (
    <main className="login-screen">
      {/* Background illustration: panoramic tractor field sunset */}
      <div className="login-bg-overlay">
        <Image
          className="login-bg-image"
          src="/images/dashboard-banner.png"
          alt={t("loginIllustrationAlt")}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
        />
        <div className="login-bg-dim" />
      </div>

      <div className="login-container">
        {/* Top Branding matching reference Screen 1 */}
        <div className="login-brand-header">
          <div className="login-tractor-logo">
            <TractorBrandIcon size={56} color="#15803d" />
          </div>
          <h1 className="login-app-title">{t("appName")}</h1>
          <p className="login-app-tagline">{t("appTagline")}</p>
        </div>

        {/* Floating White Card */}
        <section className="login-card">
          <div className="login-card-top">
            <LanguageToggle compact />
          </div>
          <form onSubmit={submit} className="login-form">
            <label className="input-group">
              <FieldLabel label={t("email")} />
              <div className="icon-input-wrap">
                <EnvelopeFill size={18} className="field-icon" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              </div>
            </label>

            <label className="input-group">
              <FieldLabel label={t("password")} />
              <div className="icon-input-wrap">
                <LockFill size={18} className="field-icon" />
                <input
                  type={passwordVisible ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? t("hidePassword") : t("showPassword")}
                >
                  {passwordVisible ? <EyeSlashFill size={19} /> : <EyeFill size={19} />}
                </button>
              </div>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="login-submit-button" disabled={busy}>
              {busy ? t("signingIn") : t("loginBtn")}
            </button>

            <div className="login-links">
              <Link className="auth-text-link" href="/forgot-password">
                {t("forgotPassword")}
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useUnsavedChangesGuard(email.trim() !== "" && !sent && !busy);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getPasswordRecoveryRedirectUrl(),
      });
    } catch {
      // Keep response generic
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <main className="login-screen">
      <div className="login-bg-overlay">
        <Image
          className="login-bg-image"
          src="/images/dashboard-banner.png"
          alt={t("loginIllustrationAlt")}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
        />
        <div className="login-bg-dim" />
      </div>
      <div className="login-container">
        <div className="login-brand-header">
          <div className="login-tractor-logo">
            <TractorBrandIcon size={48} color="#15803d" />
          </div>
          <h1 className="login-app-title">{t("appName")}</h1>
        </div>
        <section className="login-card">
          <div className="auth-flow-heading">
            <h2>{t("forgotPasswordTitle")}</h2>
            <p>{t("forgotPasswordHelp")}</p>
          </div>
          {sent ? (
            <div className="auth-confirmation" role="status">
              <p>{t("resetEmailConfirmation")}</p>
              <Link className="login-submit-button text-center block mt-4" href="/">
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="login-form">
              <label className="input-group">
                <FieldLabel label={t("email")} />
                <div className="icon-input-wrap">
                  <EnvelopeFill size={18} className="field-icon" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </div>
              </label>
              <button className="login-submit-button" disabled={busy}>
                {busy ? t("sendingResetLink") : t("sendResetLink")}
              </button>
              <Link className="auth-text-link text-center" href="/">
                {t("backToLogin")}
              </Link>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function ResetPassword({ hasRecoverySession }: { hasRecoverySession: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkFailure] = useState<RecoveryLinkFailure | null>(() => {
    const recovery = recoveryParameters();
    return recoveryLinkFailure(recovery.error, recovery.errorCode, recovery.errorDescription);
  });
  const invalidLink = Boolean(linkFailure) || !hasRecoverySession;
  const requestClose = useUnsavedChangesGuard((newPassword !== "" || confirmation !== "") && !success && !busy);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!newPassword) return setError(t("passwordRequired"));
    if (newPassword !== confirmation) return setError(t("passwordsDoNotMatch"));
    setBusy(true);
    const { error: updateError } = await getSupabase().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (updateError) {
      return setError(friendlyError(updateError.message, t));
    }
    setNewPassword("");
    setConfirmation("");
    setSuccess(true);
    window.history.replaceState(null, "", "/reset-password");
  };

  return (
    <main className="login-screen">
      <div className="login-bg-overlay">
        <Image
          className="login-bg-image"
          src="/images/dashboard-banner.png"
          alt={t("loginIllustrationAlt")}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
        />
        <div className="login-bg-dim" />
      </div>
      <div className="login-container">
        <section className="login-card">
          {invalidLink && !success ? (
            <div className="auth-confirmation error-state" role="alert">
              <p>{t(linkFailure === "expired-or-used" ? "recoveryLinkExpiredOrUsed" : "recoveryLinkInvalid")}</p>
              <Link className="login-submit-button text-center block mt-4" href="/forgot-password">
                {t("requestAnotherLink")}
              </Link>
              <Link className="auth-text-link text-center block mt-2" href="/">
                {t("backToLogin")}
              </Link>
            </div>
          ) : success ? (
            <div className="auth-confirmation success-state" role="status">
              <p>{t("passwordChanged")}</p>
              <button className="login-submit-button mt-4" onClick={() => router.replace("/")}>
                {t("continueToApp")}
              </button>
            </div>
          ) : (
            <>
              <div className="auth-flow-heading">
                <h2>{t("resetPasswordTitle")}</h2>
                <p>{t("resetPasswordHelp")}</p>
              </div>
              <form onSubmit={submit} className="login-form">
                <label className="input-group">
                  <FieldLabel label={t("newPassword")} />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <label className="input-group">
                  <FieldLabel label={t("confirmPassword")} />
                  <input
                    type="password"
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="login-submit-button" disabled={busy}>
                  {busy ? t("updatingPassword") : t("updatePassword")}
                </button>
                <button
                  type="button"
                  className="auth-text-link button-link text-center"
                  onClick={() => requestClose(() => router.replace("/"))}
                >
                  {t("backToLogin")}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// HOME / DASHBOARD (Matching Reference Screen 4)
// -------------------------------------------------------------
function Dashboard({
  customers,
  works,
  total,
  received,
  loading,
  onAdd,
  onOpenCustomer,
  onViewAllDues,
}: {
  customers: Customer[];
  works: WorkRecord[];
  total: number;
  received: number;
  loading: boolean;
  onAdd: () => void;
  onOpenCustomer: (customer: Customer) => void;
  onViewAllDues: () => void;
}) {
  const { t } = useLanguage();
  const pendingTotal = Math.max(0, total - received);

  // Group pending dues by customer
  const customerDues = useMemo(() => {
    return customers
      .map((customer) => {
        const customerWorks = works.filter((w) => w.customer_id === customer.id);
        const due = customerWorks.reduce((sum, w) => sum + balanceFor(w), 0);
        return { customer, due, workCount: customerWorks.length };
      })
      .filter((item) => item.due > 0)
      .sort((a, b) => b.due - a.due);
  }, [customers, works]);

  return (
    <div className="dashboard-content">
      {/* 1. Large "రావాల్సిన బాకీ" Card (Pale Red with Dark Red Amount) */}
      <section className="stat-card-hero">
        <div className="stat-hero-badge">
          <CashCoin size={28} />
        </div>
        <div className="stat-hero-info">
          <span className="stat-hero-label">{t("pending")}</span>
          <strong className="stat-hero-amount">{money(pendingTotal)}</strong>
        </div>
      </section>

      {/* 2. Two Smaller Cards: "మొత్తం పని" & "వచ్చిన డబ్బు" */}
      <section className="stats-row-two">
        <article className="stat-card-total">
          <div className="stat-icon-wrapper blue">
            <Truck size={20} />
          </div>
          <div className="stat-small-text">
            <span>{t("totalWork")}</span>
            <strong>{money(total)}</strong>
          </div>
        </article>

        <article className="stat-card-received">
          <div className="stat-icon-wrapper green">
            <Wallet2 size={20} />
          </div>
          <div className="stat-small-text">
            <span>{t("received")}</span>
            <strong>{money(received)}</strong>
          </div>
        </article>
      </section>

      {/* 3. Prominent "+ కొత్త పని నమోదు చేయండి" Button */}
      <button className="primary-action-card-btn" onClick={onAdd}>
        <PlusLg size={22} />
        <span>{t("addNewWorkHome")}</span>
      </button>

      {/* 4. "బాకీ ఉన్నవారు" (Pending Balances List) Section */}
      <section className="section-block">
        <div className="section-header-flex">
          <h2>{t("pendingDuesSection")}</h2>
          <button type="button" className="view-all-link" onClick={onViewAllDues}>
            {t("viewAll")} <ChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="loading-line">{t("loading")}</div>
        ) : customerDues.length ? (
          <div className="pending-farmers-list">
            {customerDues.slice(0, 5).map(({ customer, due, workCount }) => (
              <button
                key={customer.id}
                type="button"
                className="farmer-due-row"
                onClick={() => onOpenCustomer(customer)}
              >
                <div className="avatar-circle">
                  {customer.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="farmer-due-info">
                  <strong>{customer.name}</strong>
                  <small>{t("recordCount", { count: workCount })}</small>
                </div>
                <div className="farmer-due-amount">
                  <span>{money(due)}</span>
                  <ChevronRight size={18} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="no-pending-card">
            <CheckCircleFill size={24} color="#15803d" />
            <p>{t("noPendingDues")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMERS LIST (Matching Reference Screen 5)
// -------------------------------------------------------------
function Customers({
  customers,
  works,
  query,
  onQueryChange,
  onSelect,
  onAddNewCustomer,
}: {
  customers: Customer[];
  works: WorkRecord[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (customer: Customer) => void;
  onAddNewCustomer: () => void;
}) {
  const { t } = useLanguage();
  const filtered = customers.filter((customer) =>
    `${customer.name} ${customer.phone ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="customers-view-content">
      {/* Search Input */}
      <div className="search-box">
        <Search size={18} />
        <input
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      {/* "+ కొత్త కస్టమర్" Button */}
      <button className="add-farmer-top-btn" onClick={onAddNewCustomer}>
        <PlusLg size={20} />
        <span>{t("addNewCustomer")}</span>
      </button>

      {/* Customer List */}
      <section className="customer-list-card">
        {filtered.map((customer) => {
          const customerWorks = works.filter((work) => work.customer_id === customer.id);
          const due = customerWorks.reduce((sum, work) => sum + balanceFor(work), 0);
          return (
            <button
              key={customer.id}
              type="button"
              className="customer-item-row"
              onClick={() => onSelect(customer)}
            >
              <div className="avatar-circle">
                {customer.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="customer-row-details">
                <strong>{customer.name}</strong>
                <span className="customer-phone-line">
                  <Phone size={13} /> {customer.phone || t("noPhone")}
                </span>
              </div>
              <div className="customer-row-balance">
                {due > 0 ? (
                  <span className="due-amount-red">
                    {t("pendingDueBadge")} {money(due)} <ChevronRight size={14} />
                  </span>
                ) : (
                  <span className="paid-amount-green">
                    {t("pendingDueBadge")} ₹0
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {!filtered.length && (
          <EmptyState title={t("noFarmers")} text={t("noFarmersHelp")} />
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER DETAILS (Matching Reference Screen 6)
// -------------------------------------------------------------
function CustomerDetail({
  customer,
  works,
  filter,
  onFilterChange,
  onBack,
  onAddWork,
  onEditCustomer,
  onEdit,
  onShare,
  onAddPayment,
  onAddCustomerPayment,
  onShareAll,
}: {
  customer: Customer;
  works: WorkRecord[];
  filter: "all" | "pending" | "paid";
  onFilterChange: (filter: "all" | "pending" | "paid") => void;
  onBack: () => void;
  onAddWork: () => void;
  onEditCustomer: () => void;
  onEdit: (work: WorkRecord) => void;
  onShare: (work: WorkRecord) => void;
  onAddPayment: (work: WorkRecord) => void;
  onAddCustomerPayment: () => void;
  onShareAll: () => void;
}) {
  const { language, t } = useLanguage();

  const total = works.reduce((sum, work) => sum + Number(work.total), 0);
  const received = works.reduce((sum, work) => sum + paidFor(work), 0);
  const balance = works.reduce((sum, work) => sum + balanceFor(work), 0);

  const dateLabel = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(
      language === "te" ? "te-IN-u-nu-latn" : "en-IN",
      { day: "numeric", month: "short", year: "numeric" }
    );

  const cleanPhone = customer.phone?.replace(/[^\d+]/g, "") ?? "";
  const hasPhone = cleanPhone.length > 5;

  const filteredWorks = works.filter((w) => {
    const bal = balanceFor(w);
    if (filter === "pending") return bal > 0;
    if (filter === "paid") return bal <= 0;
    return true;
  });

  return (
    <div className="customer-detail-content">
      {/* Back button */}
      <button className="back-nav-bar" onClick={onBack}>
        <ArrowLeft size={20} />
        <span>{t("customerDetails")}</span>
      </button>

      {/* Customer Header Card with Call & WhatsApp icons on right */}
      <section className="customer-hero-card">
        <div className="avatar-circle large">
          {customer.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="customer-hero-text">
          <h1>{customer.name}</h1>
          <p>{customer.phone || t("noPhone")}</p>
        </div>
        <button type="button" className="quick-icon-btn call-btn" onClick={onEditCustomer} aria-label={t("editCustomer")} title={t("editCustomer")}>
          <PencilSquare size={18} />
        </button>
        {hasPhone && (
          <div className="customer-quick-call-actions">
            <a
              href={`tel:${cleanPhone}`}
              className="quick-icon-btn call-btn"
              title={t("call")}
              aria-label={t("call")}
            >
              <TelephoneFill size={18} />
            </a>
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noreferrer"
              className="quick-icon-btn whatsapp-btn"
              title="WhatsApp"
              aria-label="WhatsApp"
            >
              <Whatsapp size={20} />
            </a>
          </div>
        )}
      </section>

      {/* Big "రావాల్సిన బాకీ" Card */}
      <section className="stat-card-hero">
        <div className="stat-hero-badge">
          <CashCoin size={28} />
        </div>
        <div className="stat-hero-info">
          <span className="stat-hero-label">{t("pending")}</span>
          <strong className="stat-hero-amount">{money(balance)}</strong>
        </div>
      </section>

      {/* Two Smaller Cards: "మొత్తం పని" & "వచ్చిన డబ్బు" */}
      <section className="stats-row-two">
        <article className="stat-card-total">
          <div className="stat-icon-wrapper blue">
            <Truck size={18} />
          </div>
          <div className="stat-small-text">
            <span>{t("totalWork")}</span>
            <strong>{money(total)}</strong>
          </div>
        </article>

        <article className="stat-card-received">
          <div className="stat-icon-wrapper green">
            <Wallet2 size={18} />
          </div>
          <div className="stat-small-text">
            <span>{t("received")}</span>
            <strong>{money(received)}</strong>
          </div>
        </article>
      </section>

      {/* Three Stacked Primary Actions (Compact Heights) */}
      <div className="customer-stacked-actions">
        <button className="stacked-btn blue" onClick={onAddWork}>
          <PlusLg size={18} />
          <span>{t("addWork")}</span>
        </button>

        {balance > 0 && (
          <button className="stacked-btn green" onClick={onAddCustomerPayment}>
            <CashCoin size={18} />
            <span>{t("addPayment")}</span>
          </button>
        )}

        <button className="stacked-btn whatsapp" onClick={onShareAll}>
          <Whatsapp size={19} />
          <span>{t("shareOnWhatsApp")}</span>
        </button>
      </div>

      {/* Work History Section (Directly visible without accordion) */}
      <section className="history-section-clean">
        <div className="history-section-header">
          <h2>{t("oldRecords")}</h2>
          <div className="history-filter-pills">
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => onFilterChange("all")}
            >
              {t("allWorks")}
            </button>
            <button
              type="button"
              className={filter === "pending" ? "active" : ""}
              onClick={() => onFilterChange("pending")}
            >
              {t("paymentDue")}
            </button>
            <button
              type="button"
              className={filter === "paid" ? "active" : ""}
              onClick={() => onFilterChange("paid")}
            >
              {t("paid")}
            </button>
          </div>
        </div>

        {filteredWorks.length ? (
          <div className="work-cards-list">
            {filteredWorks.map((work) => {
              const workBalance = balanceFor(work);
              const workPaid = paidFor(work);
              const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
              const isPaid = workBalance <= 0;

              return (
                <article className="work-item-card" key={work.id}>
                  <div className="work-item-header">
                    <div className="work-item-type-wrap">
                      <div className="work-type-mini-icon">
                        <WorkTypeIcon name={work.work_type_name} size={20} />
                      </div>
                      <div>
                        <strong>{displayWorkType(work.work_type_name, language)}</strong>
                        <small>{dateLabel(work.work_date)}</small>
                      </div>
                    </div>
                    {isPaid ? (
                      <span className="badge-paid">{t("fullyPaid")}</span>
                    ) : (
                      <span className="badge-due">{money(workBalance)} {t("pendingDueBadge")}</span>
                    )}
                  </div>

                  <div className="work-item-math">
                    <span>{work.quantity} {unit} × {money(work.rate)}</span>
                  </div>

                  <div className="work-item-financials">
                    <p><span>{t("totalWork")}:</span> <b>{money(work.total)}</b></p>
                    <p><span>{t("received")}:</span> <b>{money(workPaid)}</b></p>
                    <p className={workBalance > 0 ? "due-red" : "paid-green"}>
                      <span>{t("balanceDue")}:</span> <b>{money(workBalance)}</b>
                    </p>
                  </div>

                  {/* Actions placed side-by-side */}
                  <div className="work-item-actions-row">
                    <button
                      type="button"
                      className="work-action-btn"
                      onClick={() => onEdit(work)}
                    >
                      <PencilSquare size={16} /> {t("editWork")}
                    </button>
                    <button
                      type="button"
                      className="work-action-btn"
                      onClick={() => onShare(work)}
                    >
                      <Whatsapp size={16} /> {t("shareReceipt")}
                    </button>
                    {workBalance > 0 && (
                      <button
                        type="button"
                        className="work-action-btn pay-action"
                        onClick={() => onAddPayment(work)}
                      >
                        <PlusLg size={16} /> {t("addPayment")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t("noOldWorkHistory")} text={t("noFarmerWorkHelp")} />
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// PENDING DUES TAB (Tab 4: బాకీలు)
// -------------------------------------------------------------
function PendingDuesView({
  customers,
  works,
  onSelect,
}: {
  customers: Customer[];
  works: WorkRecord[];
  onSelect: (customer: Customer) => void;
}) {
  const { t } = useLanguage();

  const customerDues = useMemo(() => {
    return customers
      .map((customer) => {
        const customerWorks = works.filter((w) => w.customer_id === customer.id);
        const due = customerWorks.reduce((sum, w) => sum + balanceFor(w), 0);
        return { customer, due, workCount: customerWorks.length };
      })
      .filter((item) => item.due > 0)
      .sort((a, b) => b.due - a.due);
  }, [customers, works]);

  const totalPending = customerDues.reduce((sum, item) => sum + item.due, 0);

  return (
    <div className="pending-view-content">
      {/* Large Total Pending Card */}
      <section className="stat-card-hero">
        <div className="stat-hero-badge">
          <CashCoin size={28} />
        </div>
        <div className="stat-hero-info">
          <span className="stat-hero-label">{t("customerOutstandingBalance")}</span>
          <strong className="stat-hero-amount">{money(totalPending)}</strong>
        </div>
      </section>

      <div className="section-header-simple">
        <h2>{t("pendingDuesSection")}</h2>
        <span>{customerDues.length} {t("customers")}</span>
      </div>

      <div className="pending-farmers-list card-mode">
        {customerDues.length ? (
          customerDues.map(({ customer, due, workCount }) => (
            <button
              key={customer.id}
              type="button"
              className="farmer-due-row"
              onClick={() => onSelect(customer)}
            >
              <div className="avatar-circle">
                {customer.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="farmer-due-info">
                <strong>{customer.name}</strong>
                <small>{customer.phone || t("recordCount", { count: workCount })}</small>
              </div>
              <div className="farmer-due-amount">
                <span>{money(due)}</span>
                <ChevronRight size={18} />
              </div>
            </button>
          ))
        ) : (
          <div className="no-pending-card">
            <CheckCircleFill size={32} color="#15803d" />
            <p>{t("noPendingDues")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ADD / EDIT WORK MODAL (Matching Reference Screen 7)
// -------------------------------------------------------------
function WorkModal({
  customers,
  workTypes,
  work,
  initialCustomerId,
  userId,
  onClose,
  onSaved,
  setNotice,
  onCustomerCreated,
}: {
  customers: Customer[];
  workTypes: WorkType[];
  work?: WorkRecord;
  initialCustomerId?: string;
  userId: string;
  onClose: () => void;
  onSaved: (work: WorkRecord) => void;
  setNotice: (notice: Notice) => void;
  onCustomerCreated: (customer: Customer) => void;
}) {
  const { language, t } = useLanguage();
  const initialCustId = work?.customer_id ?? initialCustomerId ?? "";
  const initialMode = work || initialCustId ? "existing" : customers.length ? "existing" : "new";
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(initialMode);
  const [customerId, setCustomerId] = useState(initialCustId);
  const [farmerName, setFarmerName] = useState("");
  const [phone, setPhone] = useState("");
  const contactPickerSupported = useSyncExternalStore(
    subscribeToContactPickerSupport,
    getContactPickerSupport,
    getServerContactPickerSupport
  );

  const [workDate, setWorkDate] = useState(work?.work_date ?? today());
  const initialWorkTypeId = work?.work_type_id ?? (workTypes.find((type) => type.active)?.id ?? "");
  const initialBasis: ChargeBasis = work?.charge_basis ?? "acre";
  const [workTypeId, setWorkTypeId] = useState(initialWorkTypeId);
  const [basis, setBasis] = useState<ChargeBasis>(initialBasis);
  const [quantity, setQuantity] = useState(work ? String(work.quantity) : "1");

  const activeTypes = workTypes.filter((type) => type.active || type.id === workTypeId);
  const selectedType = workTypes.find((type) => type.id === workTypeId);

  const [rate, setRate] = useState(
    work ? String(work.rate) : configuredRate(selectedType, initialBasis)
  );
  const [received, setReceived] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const numQty = Math.max(0, Number(quantity) || 0);
  const numRate = Math.max(0, Number(rate) || 0);
  const total = Math.round(numQty * numRate * 100) / 100;
  const alreadyPaid = work ? paidFor(work) : 0;
  const numReceived = Math.max(0, Number(received) || 0);
  const remainingDue = Math.max(0, total - (work ? alreadyPaid : numReceived));

  const isDirty = customerMode !== initialMode ||
    customerId !== initialCustId ||
    farmerName !== "" || phone !== "" ||
    workDate !== (work?.work_date ?? today()) ||
    workTypeId !== initialWorkTypeId || basis !== initialBasis ||
    quantity !== (work ? String(work.quantity) : "1") ||
    rate !== (work ? String(work.rate) : configuredRate(selectedType, initialBasis)) ||
    received !== "0";

  const requestClose = useUnsavedChangesGuard(isDirty && !busy);
  const closeWithConfirmation = () => requestClose(onClose);

  const selectWorkType = (nextWorkTypeId: string) => {
    setWorkTypeId(nextWorkTypeId);
    const targetType = workTypes.find((type) => type.id === nextWorkTypeId);
    const newRate = configuredRate(targetType, basis);
    setRate(newRate);
  };

  const selectBasis = (nextBasis: ChargeBasis) => {
    setBasis(nextBasis);
    const newRate = configuredRate(selectedType, nextBasis);
    setRate(newRate);
  };

  const adjustQuantity = (delta: number) => {
    const current = Number(quantity) || 0;
    const next = Math.max(0.25, Math.round((current + delta) * 100) / 100);
    setQuantity(String(next));
  };

  const selectContact = async () => {
    const contacts = navigator.contacts;
    if (!contacts) return;
    try {
      const selected = await contacts.select(["name", "tel"], { multiple: false });
      const contact = selected[0];
      if (!contact) return;
      const selectedName = contact.name?.find((n) => n.trim())?.trim();
      const numbers = [...new Set((contact.tel ?? []).map((num) => num.trim()).filter(Boolean))];
      if (selectedName) setFarmerName(selectedName);
      if (numbers.length > 0) setPhone(numbers[0]);
    } catch {
      setError(t("contactPickerError"));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    const unitRate = Number(rate);
    const initialPayment = Number(received || 0);

    if ((work || customerMode === "existing") && !customerId) return setError(t("chooseFarmer"));
    if (!work && customerMode === "new" && !farmerName.trim()) return setError(t("enterFarmerName"));
    if (!workTypeId) return setError(t("chooseWorkType"));
    if (rate.trim() === "") return setError(t("rateNotConfigured"));
    if (qty <= 0 || unitRate < 0 || initialPayment < 0) return setError(t("invalidAmounts"));
    if (work && total < alreadyPaid) return setError(t("totalBelowPaid", { amount: money(alreadyPaid) }));
    if (!work && initialPayment > total) return setError(t("receivedTooHigh"));

    setBusy(true);
    const supabase = getSupabase();
    let finalCustomerId = customerId;

    if (!work && customerMode === "new") {
      const { data, error: customerError } = await supabase
        .from("customers")
        .insert({ user_id: userId, name: farmerName.trim(), phone: phone.trim() || null })
        .select()
        .single();
      if (customerError) {
        setBusy(false);
        return setError(friendlyError(customerError.message, t));
      }
      finalCustomerId = data.id;
      onCustomerCreated(data as Customer);
    }

    if (!finalCustomerId) {
      setBusy(false);
      return setError(t("chooseFarmer"));
    }

    const currentSelectedType = workTypes.find((type) => type.id === workTypeId);
    const values = {
      user_id: userId,
      customer_id: finalCustomerId,
      work_type_id: workTypeId,
      work_type_name: currentSelectedType?.name ?? work?.work_type_name ?? "Work",
      work_date: workDate,
      charge_basis: basis,
      quantity: qty,
      rate: unitRate,
    };

    const result = work
      ? await supabase.from("work_records").update(values).eq("id", work.id).select("*, customer:customers(*), payments(*)").single()
      : await supabase.from("work_records").insert(values).select("*, customer:customers(*), payments(*)").single();

    if (result.error) {
      setBusy(false);
      return setError(friendlyError(result.error.message, t));
    }

    let saved = result.data as unknown as WorkRecord;
    if (!work && initialPayment > 0) {
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: userId,
          work_record_id: saved.id,
          payment_date: workDate,
          amount: initialPayment,
          method: "Cash",
        })
        .select()
        .single();
      if (paymentError) {
        setBusy(false);
        setNotice({ tone: "error", text: t("workSavedPaymentFailed", { error: paymentError.message }) });
      } else {
        saved = { ...saved, payments: [payment as Payment] };
      }
    }

    setBusy(false);
    onSaved(saved);
  };

  return (
    <div className="workflow-body">
      <section className="workflow-panel work-modal" aria-labelledby="work-modal-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{work ? t("editRecord") : t("newRecord")}</p>
            <h2 id="work-modal-title">{work ? t("editWork") : t("addWork")}</h2>
          </div>
          <IconButton icon={X} label={t("close")} onClick={closeWithConfirmation} />
        </div>

        <form onSubmit={submit} className="add-work-form">
          {/* 1. ఎవరి పని? (Customer Select) */}
          <div className="form-section">
            <div className="form-section-title-row">
              <FieldLabel label={t("whoseWork")} />
              {!work && (
                <div className="customer-mode-pills">
                  <button
                    type="button"
                    className={customerMode === "existing" ? "active" : ""}
                    onClick={() => setCustomerMode("existing")}
                  >
                    {t("existingFarmer")}
                  </button>
                  <button
                    type="button"
                    className={customerMode === "new" ? "active" : ""}
                    onClick={() => setCustomerMode("new")}
                  >
                    {t("newFarmer")}
                  </button>
                </div>
              )}
            </div>

            {customerMode === "existing" || work ? (
              <div className="select-wrap">
                <select
                  value={customerId}
                  onChange={(e) => { setCustomerId(e.target.value); setError(""); }}
                  required
                >
                  <option value="" disabled>{t("selectFarmer")}...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="new-farmer-fields">
                {contactPickerSupported && (
                  <button
                    type="button"
                    className="contact-picker-btn"
                    onClick={() => void selectContact()}
                  >
                    <Phone size={16} /> {t("selectContact")}
                  </button>
                )}
                <input
                  placeholder={t("farmerName")}
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  required
                />
                <input
                  type="tel"
                  placeholder={t("phoneNumber") + " (" + t("optional") + ")"}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 2. ఏ పని చేశారు? (Work Type Grid of Tiles with Icons) */}
          <div className="form-section">
            <FieldLabel label={t("whatWorkDone")} />
            <div className="work-type-tiles-grid">
              {activeTypes.map((type) => {
                const isSelected = type.id === workTypeId;
                const meta = getWorkTypeMeta(type.name);
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={`work-type-tile ${isSelected ? "selected" : ""}`}
                    onClick={() => selectWorkType(type.id)}
                    style={{
                      borderColor: isSelected ? "#15803d" : meta.border,
                      background: isSelected ? "#f0fdf4" : meta.bg,
                    }}
                  >
                    <div className="tile-icon-wrap" style={{ background: isSelected ? "#dcfce7" : "#ffffff" }}>
                      <WorkTypeIcon name={type.name} size={28} />
                    </div>
                    <span className="tile-name">
                      {displayWorkType(type.name, language)}
                    </span>
                    {isSelected && (
                      <div className="tile-check-badge">
                        <CheckCircleFill size={14} color="#15803d" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. తేదీ & లెక్కింపు విధానం (Date & Acre/Hour Toggle) */}
          <div className="form-row-two">
            <label className="input-group">
              <FieldLabel label={t("workDate")} />
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
              />
            </label>

            <div className="input-group">
              <FieldLabel label={t("chargeBasis")} />
              <div className="segmented-toggle">
                <button
                  type="button"
                  className={basis === "acre" ? "active" : ""}
                  onClick={() => selectBasis("acre")}
                >
                  {t("perAcre")}
                </button>
                <button
                  type="button"
                  className={basis === "hour" ? "active" : ""}
                  onClick={() => selectBasis("hour")}
                >
                  {t("perHour")}
                </button>
              </div>
            </div>
          </div>

          {/* 4. ఎన్ని ఎకరాలు / గంటలు? (Quantity with Stepper) & ధర (Rate) */}
          <div className="form-row-two">
            <div className="input-group">
              <FieldLabel label={basis === "acre" ? t("howManyAcres") : t("howManyHours")} />
              <div className="stepper-input">
                <button type="button" onClick={() => adjustQuantity(-0.5)}>
                  <Dash size={18} />
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
                <button type="button" onClick={() => adjustQuantity(0.5)}>
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <label className="input-group">
              <FieldLabel label={basis === "acre" ? t("ratePerAcreShort") : t("ratePerHourShort")} />
              <div className="currency-input-wrap">
                <span>₹</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                />
              </div>
              {rate === "" && <small className="field-help rate-required-help">{t("rateNotConfigured")}</small>}
            </label>
          </div>

          {/* 5. ఇప్పుడు ఇచ్చిన డబ్బు (Down Payment) if creating new work */}
          {!work && (
            <label className="input-group">
              <FieldLabel label={t("nowReceived")} />
              <div className="currency-input-wrap">
                <span>₹</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={total}
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </div>
            </label>
          )}

          {/* 6. Summary Calculation Card (3 Columns) */}
          <div className="work-summary-calc-card">
            <div className="calc-col">
              <span>{t("totalWork")}</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="calc-col">
              <span>{t("nowReceived")}</span>
              <strong>{money(work ? alreadyPaid : numReceived)}</strong>
            </div>
            <div className="calc-col due-col">
              <span>{t("remainingBalanceDue")}</span>
              <strong>{money(remainingDue)}</strong>
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="form-actions-sticky">
            <button type="submit" className="save-work-submit-btn" disabled={busy}>
              {busy ? t("saving") : t("saveWorkBtn")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// WORK SAVED & SHARE MODAL (Matching Reference Screen 9)
// -------------------------------------------------------------
function WorkSavedModal({
  work,
  onClose,
  onGoToCustomer,
  onShare,
}: {
  work: WorkRecord;
  onClose: () => void;
  onGoToCustomer: () => void;
  onShare: () => void;
}) {
  const { language, t } = useLanguage();
  const customer = work.customer;
  const balance = balanceFor(work);
  const paid = paidFor(work);
  const date = new Date(`${work.work_date}T00:00:00`).toLocaleDateString(
    language === "te" ? "te-IN-u-nu-latn" : "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );
  const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
  return (
    <div className="workflow-body">
      <section className="workflow-panel work-saved-page">
        {/* Large Green Checkmark */}
        <div className="saved-success-badge">
          <CheckCircleFill size={64} color="#15803d" />
        </div>
        <h2 className="saved-success-title">{t("workSavedTitle")}</h2>

        {/* Work summary card */}
        <div className="saved-summary-card">
          <div className="saved-customer-head">
            <div className="avatar-circle">
              {customer?.name ? customer.name.slice(0, 1).toUpperCase() : "R"}
            </div>
            <div>
              <strong>{customer?.name}</strong>
              <small>{displayWorkType(work.work_type_name, language)} - {work.quantity} {unit} · {date}</small>
            </div>
          </div>

          <div className="saved-detail-lines">
            <div className="line">
              <span>{work.charge_basis === "hour" ? t("ratePerHourShort") : t("ratePerAcreShort")}:</span>
              <b>{money(work.rate)}</b>
            </div>
            <div className="line">
              <span>{t("totalWork")}:</span>
              <b>{money(work.total)}</b>
            </div>
            <div className="line">
              <span>{t("received")}:</span>
              <b>{money(paid)}</b>
            </div>
            <div className="line due-line">
              <span>{t("pendingDueBadge")}:</span>
              <b>{money(balance)}</b>
            </div>
          </div>
        </div>

        {/* WhatsApp & Home Buttons */}
        <div className="saved-actions">
          <a
            className="whatsapp-primary-share-btn"
            href="#share-preview"
            onClick={(event) => { event.preventDefault(); onShare(); }}
          >
            <Whatsapp size={22} />
            <span>{t("shareReceiptTitle")}</span>
          </a>

          <button type="button" className="home-secondary-btn" onClick={onClose}>
            {t("back")}
          </button>
          <button type="button" className="home-secondary-btn" onClick={onGoToCustomer}>
            {t("customerDetails")}
          </button>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// ADD PAYMENT MODAL (Matching Reference Screen 8)
// -------------------------------------------------------------
function PaymentModal({
  work,
  onClose,
  onSaved,
  setNotice,
}: {
  work: WorkRecord;
  onClose: () => void;
  onSaved: () => void;
  setNotice: (notice: Notice) => void;
}) {
  const { t } = useLanguage();
  const balance = balanceFor(work);
  const [amount, setAmount] = useState(String(balance));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const numAmount = Math.max(0, Number(amount) || 0);
  const remainingAfter = Math.max(0, balance - numAmount);

  const isDirty = amount !== String(balance) || date !== today() || method !== "Cash";
  const requestClose = useUnsavedChangesGuard(isDirty && !busy);
  const closeWithConfirmation = () => requestClose(onClose);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!method) return setError(t("choosePaymentMethod"));
    if (value <= 0) return setError(t("paymentPositive"));
    if (value > balance) return setError(t("paymentTooHigh", { amount: money(balance) }));

    setBusy(true);
    const { data: userData } = await getSupabase().auth.getUser();
    const { error: saveError } = await getSupabase().from("payments").insert({
      user_id: userData.user?.id,
      work_record_id: work.id,
      payment_date: date,
      amount: value,
      method,
    });
    setBusy(false);

    if (saveError) {
      setError(friendlyError(saveError.message, t));
    } else {
      setNotice({ tone: "success", text: t("paymentSaved") });
      onSaved();
    }
  };

  return (
    <div className="workflow-body">
      <section className="workflow-panel payment-page">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{work.customer?.name}</p>
            <h2>{t("addPayment")}</h2>
          </div>
          <IconButton icon={X} label={t("close")} onClick={closeWithConfirmation} />
        </div>

        <form onSubmit={submit} className="payment-form">
          {/* Customer info preview */}
          <div className="payment-customer-row">
            <div className="avatar-circle">
              {work.customer?.name ? work.customer.name.slice(0, 1).toUpperCase() : "R"}
            </div>
            <strong>{work.customer?.name}</strong>
          </div>

          {/* ప్రస్తుత బాకీ (Current Balance - Pale Red) */}
          <div className="stat-card-hero compact">
            <div className="stat-hero-badge">
              <CashCoin size={24} />
            </div>
            <div className="stat-hero-info">
              <span className="stat-hero-label">{t("currentBalance")}</span>
              <strong className="stat-hero-amount">{money(balance)}</strong>
            </div>
          </div>

          {/* ఎంత ఇచ్చారు? (Amount Received Input) */}
          <label className="input-group">
            <FieldLabel label={t("howMuchPaid")} />
            <div className="currency-input-wrap large">
              <span>₹</span>
              <input
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
          </label>

          {/* చెల్లింపు తేదీ & విధానం */}
          <div className="form-row-two">
            <label className="input-group">
              <FieldLabel label={t("paymentDate")} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>

            <label className="input-group">
              <FieldLabel label={t("paymentMethod")} />
              <select value={method} onChange={(e) => setMethod(e.target.value)} required>
                <option value="Cash">{t("cash")}</option>
                <option value="UPI">{t("upi")}</option>
                <option value="Bank transfer">{t("bankTransfer")}</option>
                <option value="Other">{t("other")}</option>
              </select>
            </label>
          </div>

          {/* మిగిలిన బాకీ (Remaining Balance - Pale Green) */}
          <div className="remaining-balance-pill">
            <span>{t("remainingBalanceDue")}</span>
            <strong>{money(remainingAfter)}</strong>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="save-work-submit-btn" disabled={busy}>
            {busy ? t("saving") : t("recordPaymentBtn")}
          </button>
        </form>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER-WIDE PAYMENT MODAL (Oldest-First FIFO Allocation)
// -------------------------------------------------------------
function CustomerPaymentModal({
  customer,
  works,
  onClose,
  onSaved,
  setNotice,
}: {
  customer: Customer;
  works: WorkRecord[];
  onClose: () => void;
  onSaved: () => void;
  setNotice: (notice: Notice) => void;
}) {
  const { t } = useLanguage();
  const balance = works.reduce((sum, work) => sum + balanceFor(work), 0);
  const initialAmount = String(balance);
  const [amount, setAmount] = useState(initialAmount);
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);

  const enteredAmount = Number(amount);
  const remainingBalance = Math.max(0, balance - (Number.isFinite(enteredAmount) ? enteredAmount : 0));
  const isDirty = amount !== initialAmount || date !== today() || method !== "Cash";
  const requestClose = useUnsavedChangesGuard(isDirty && !busy);
  const closeWithConfirmation = () => requestClose(onClose);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const value = Number(amount);
    if (!method) return setError(t("choosePaymentMethod"));
    if (!Number.isFinite(value) || value <= 0) return setError(t("paymentPositive"));
    if (value > balance) return setError(t("paymentTooHigh", { amount: money(balance) }));

    submitting.current = true;
    setBusy(true);
    const { error: saveError } = await getSupabase().rpc("record_customer_payment", {
      p_customer_id: customer.id,
      p_amount: value,
      p_payment_date: date,
      p_method: method,
      p_request_id: requestId,
    });
    setBusy(false);
    submitting.current = false;

    if (saveError) {
      if (saveError.message.toLowerCase().includes("outstanding customer balance")) {
        setError(t("customerBalanceChanged"));
      } else if (saveError.message.toLowerCase().includes("idempotency")) {
        setError(t("paymentRequestConflict"));
      } else {
        setError(friendlyError(saveError.message, t));
      }
      return;
    }

    setNotice({ tone: "success", text: t("customerPaymentSaved") });
    onSaved();
  };

  return (
    <div className="workflow-body">
      <section className="workflow-panel payment-page">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{customer.name}</p>
            <h2>{t("addPayment")}</h2>
          </div>
          <IconButton icon={X} label={t("close")} onClick={closeWithConfirmation} />
        </div>

        <form onSubmit={submit} className="payment-form">
          {/* Customer info */}
          <div className="payment-customer-row">
            <div className="avatar-circle">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <strong>{customer.name}</strong>
          </div>

          {/* ప్రస్తుత బాకీ (Pale Red) */}
          <div className="stat-card-hero compact">
            <div className="stat-hero-badge">
              <CashCoin size={24} />
            </div>
            <div className="stat-hero-info">
              <span className="stat-hero-label">{t("currentBalance")}</span>
              <strong className="stat-hero-amount">{money(balance)}</strong>
            </div>
          </div>

          {/* ఎంత ఇచ్చారు? */}
          <label className="input-group">
            <FieldLabel label={t("howMuchPaid")} />
            <div className="currency-input-wrap large">
              <span>₹</span>
              <input
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
          </label>

          <div className="form-row-two">
            <label className="input-group">
              <FieldLabel label={t("paymentDate")} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>

            <label className="input-group">
              <FieldLabel label={t("paymentMethod")} />
              <select value={method} onChange={(e) => setMethod(e.target.value)} required>
                <option value="Cash">{t("cash")}</option>
                <option value="UPI">{t("upi")}</option>
                <option value="Bank transfer">{t("bankTransfer")}</option>
                <option value="Other">{t("other")}</option>
              </select>
            </label>
          </div>

          {/* మిగిలిన బాకీ (Pale Green) */}
          <div className="remaining-balance-pill">
            <span>{t("remainingBalanceDue")}</span>
            <strong>{money(remainingBalance)}</strong>
          </div>

          <p className="field-help">{t("oldestWorkAllocationHelp")}</p>
          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="save-work-submit-btn" disabled={busy}>
            {busy ? t("saving") : t("recordPaymentBtn")}
          </button>
        </form>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// NEW CUSTOMER MODAL
// -------------------------------------------------------------
function NewCustomerModal({
  userId,
  customer,
  onClose,
  onSaved,
  setNotice,
}: {
  userId: string;
  customer?: Customer;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
  setNotice: (notice: Notice) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isDirty = name !== (customer?.name ?? "") || phone !== (customer?.phone ?? "");
  const requestClose = useUnsavedChangesGuard(isDirty && !busy);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError(t("enterFarmerName"));
    setBusy(true);
    setError("");
    const values = {
        user_id: userId,
        name: name.trim(),
        phone: phone.trim() || null,
    };
    const request = customer
      ? getSupabase().from("customers").update(values).eq("id", customer.id)
      : getSupabase().from("customers").insert(values);
    const { data, error: insertError } = await request
      .select()
      .single();
    setBusy(false);

    if (insertError) {
      setError(friendlyError(insertError.message, t));
    } else {
      setNotice({ tone: "success", text: customer ? t("customerUpdated") : t("savedSuccessfully") });
      onSaved(data as Customer);
    }
  };

  return (
    <div className="workflow-body">
      <section className="workflow-panel farmer-form-page">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{t("customers")}</p>
            <h2>{customer ? t("editCustomer") : t("addNewCustomer")}</h2>
          </div>
          <IconButton icon={X} label={t("close")} onClick={() => requestClose(onClose)} />
        </div>
        <form onSubmit={submit} className="stack-form">
          <label className="input-group">
            <FieldLabel label={t("farmerName")} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh"
              required
              autoFocus
            />
          </label>
          <label className="input-group">
            <FieldLabel label={t("phoneNumber")} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="login-submit-button" disabled={busy}>
            {busy ? t("saving") : t("save")}
          </button>
        </form>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// WORK TYPES & RATES (Matching Reference Screen 11)
// -------------------------------------------------------------
function WorkTypeSettings({
  workTypes,
  onRefresh,
  setNotice,
  onAdd,
  onEdit,
}: {
  workTypes: WorkType[];
  onRefresh: () => Promise<void>;
  setNotice: (notice: Notice) => void;
  onAdd: () => void;
  onEdit: (workType: WorkType) => void;
}) {
  const { language, t } = useLanguage();

  const toggle = async (workType: WorkType) => {
    const { error } = await getSupabase()
      .from("work_types")
      .update({ active: !workType.active })
      .eq("id", workType.id);
    if (error) setNotice({ tone: "error", text: friendlyError(error.message, t) });
    else await onRefresh();
  };

  return (
    <div className="work-types-settings-page">
      <div className="work-types-list-cards">
        {workTypes.map((type) => (
          <WorkTypeRateRow
            key={type.id}
            workType={type}
            language={language}
            onToggle={() => void toggle(type)}
            onEdit={() => onEdit(type)}
          />
        ))}
      </div>

      <button type="button" className="add-type-btn" onClick={onAdd}>
          <PlusLg size={18} />
          <span>{t("addWorkType")}</span>
      </button>
    </div>
  );
}

function WorkTypeRateRow({
  workType,
  language,
  onToggle,
  onEdit,
}: {
  workType: WorkType;
  language: "te" | "en";
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { t } = useLanguage();

  return (
    <article className="work-type-rate-row">
      <div className="type-row-top">
        <div className="type-icon-name-wrap">
          <div className="type-avatar">
            <WorkTypeIcon name={workType.name} size={24} />
          </div>
          <div>
            <strong>{displayWorkType(workType.name, language)}</strong>
            <small>{workType.acre_rate == null ? t("configuredRateMissing") : `₹${money(workType.acre_rate)} / ${t("perAcre")}`} · {workType.hour_rate == null ? t("configuredRateMissing") : `₹${money(workType.hour_rate)} / ${t("perHour")}`}</small>
          </div>
        </div>
        <div className="type-actions-wrap">
          <button
            type="button"
            className="edit-pencil-btn"
            onClick={onEdit}
            title={t("editWorkType")}
            aria-label={t("editWorkType")}
          >
            <PencilSquare size={18} />
          </button>
          <label className="switch" title={workType.active ? t("availableInForm") : t("hiddenFromForm")}>
            <input type="checkbox" checked={workType.active} onChange={onToggle} />
            <span />
          </label>
        </div>
      </div>
    </article>
  );
}

function WorkTypeForm({
  workType,
  onSaved,
  setNotice,
}: {
  workType?: WorkType;
  onSaved: () => Promise<void>;
  setNotice: (notice: Notice) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(workType?.name ?? "");
  const [acreRate, setAcreRate] = useState(workType?.acre_rate == null ? "" : String(workType.acre_rate));
  const [hourRate, setHourRate] = useState(workType?.hour_rate == null ? "" : String(workType.hour_rate));
  const [active, setActive] = useState(workType?.active ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isDirty = name !== (workType?.name ?? "") || acreRate !== (workType?.acre_rate == null ? "" : String(workType.acre_rate)) || hourRate !== (workType?.hour_rate == null ? "" : String(workType.hour_rate)) || active !== (workType?.active ?? true);
  useUnsavedChangesGuard(isDirty && !busy);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const parsedAcreRate = acreRate === "" ? null : Number(acreRate);
    const parsedHourRate = hourRate === "" ? null : Number(hourRate);
    if (!name.trim()) return setError(t("enterWorkTypeName"));
    if ([parsedAcreRate, parsedHourRate].some((rate) => rate != null && (!Number.isFinite(rate) || rate < 0))) {
      return setError(t("invalidRate"));
    }

    setBusy(true);
    const supabase = getSupabase();
    const values = { name: name.trim(), acre_rate: parsedAcreRate, hour_rate: parsedHourRate, active };
    const result = workType
      ? await supabase.from("work_types").update(values).eq("id", workType.id)
      : await supabase.from("work_types").insert({ ...values, user_id: (await supabase.auth.getUser()).data.user?.id });
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error.message, t));
      return;
    }
    setNotice({ tone: "success", text: workType ? t("workTypeUpdated") : t("workTypeAdded") });
    await onSaved();
  };

  return (
    <form className="workflow-form" onSubmit={submit}>
      <label className="input-group">
        <FieldLabel label={t("workTypeName")} />
        <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
      </label>
      <div className="workflow-rate-fields">
        <label className="input-group">
          <FieldLabel label={t("acreRate")} />
          <div className="currency-input-wrap"><span>₹</span><input type="number" min="0" step="0.01" inputMode="decimal" value={acreRate} onChange={(event) => setAcreRate(event.target.value)} placeholder={t("configuredRateMissing")} /></div>
        </label>
        <label className="input-group">
          <FieldLabel label={t("hourRate")} />
          <div className="currency-input-wrap"><span>₹</span><input type="number" min="0" step="0.01" inputMode="decimal" value={hourRate} onChange={(event) => setHourRate(event.target.value)} placeholder={t("configuredRateMissing")} /></div>
        </label>
      </div>
      <label className="workflow-active-toggle">
        <span>{t("availableInForm")}</span>
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="save-work-submit-btn" disabled={busy}>{busy ? t("saving") : t("save")}</button>
    </form>
  );
}

// -------------------------------------------------------------
// SETTINGS / PROFILE (Matching Reference Screen 12)
// -------------------------------------------------------------
function SettingsView({
  session,
  workTypes,
  onSignOut,
  onOpenWorkTypes,
  onChangePassword,
}: {
  session: Session | null;
  workTypes: WorkType[];
  onSignOut: () => void;
  onOpenWorkTypes: () => void;
  onChangePassword: () => void;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="settings-page-content">
      {/* User Account Profile Card */}
      <section className="profile-summary-card">
        <div className="avatar-circle large">
          <PersonFill size={36} color="#ffffff" />
        </div>
        <div className="profile-info-text">
          <strong>{session?.user?.email?.split("@")[0] ?? "Owner"}</strong>
          <small>{session?.user?.email ?? ""}</small>
        </div>
      </section>

      {/* Settings Navigation Menu */}
      <section className="settings-menu-list">
        {/* Language switch */}
        <button
          type="button"
          className="settings-menu-item"
          onClick={() => setLanguage(language === "te" ? "en" : "te")}
        >
          <div className="menu-icon-wrap">
            <Translate size={20} />
          </div>
          <div className="menu-text">
            <span>{t("language")}</span>
            <small>{language === "te" ? "తెలుగు" : "English"}</small>
          </div>
          <ChevronRight size={18} />
        </button>

        {/* Work Types & Rates */}
        <button
          type="button"
          className="settings-menu-item"
          onClick={onOpenWorkTypes}
        >
          <div className="menu-icon-wrap">
            <Sliders size={20} />
          </div>
          <div className="menu-text">
            <span>{t("workTypesAndRates")}</span>
            <small>{workTypes.length} {t("workTypes")}</small>
          </div>
          <ChevronRight size={18} />
        </button>

        {/* Change password */}
        <button
          type="button"
          className="settings-menu-item"
          onClick={onChangePassword}
        >
          <div className="menu-icon-wrap">
            <KeyFill size={20} />
          </div>
          <div className="menu-text">
            <span>{t("changePasswordOption")}</span>
          </div>
          <ChevronRight size={18} />
        </button>

        {/* Logout (Red) */}
        <button
          type="button"
          className="settings-menu-item logout-item"
          onClick={onSignOut}
        >
          <div className="menu-icon-wrap red">
            <BoxArrowRight size={20} />
          </div>
          <div className="menu-text">
            <span>{t("signOut")}</span>
          </div>
        </button>
      </section>

    </div>
  );
}

function ChangePasswordPanel() {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [needsCurrentPassword, setNeedsCurrentPassword] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const isDirty = newPassword !== "" || confirmation !== "" || currentPassword !== "";
  useUnsavedChangesGuard(isDirty && !busy);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!newPassword) return setError(t("passwordRequired"));
    if (newPassword !== confirmation) return setError(t("passwordsDoNotMatch"));
    if (needsCurrentPassword && !currentPassword) return setError(t("currentPasswordRequired"));

    setBusy(true);
    const attributes: { password: string; current_password?: string } = { password: newPassword };
    if (needsCurrentPassword) attributes.current_password = currentPassword;
    const { error: updateError } = await getSupabase().auth.updateUser(attributes);
    setBusy(false);

    if (updateError) {
      const lower = updateError.message.toLowerCase();
      if (lower.includes("current password")) {
        setNeedsCurrentPassword(true);
        setError(t("reauthCurrentRequired"));
      } else {
        setError(friendlyError(updateError.message, t));
      }
      return;
    }

    setNewPassword("");
    setConfirmation("");
    setCurrentPassword("");
    setNeedsCurrentPassword(false);
    setStatus(t("passwordChanged"));
  };

  return (
    <form className="password-form-card" onSubmit={submit}>
      <h3>{t("changePassword")}</h3>
      {needsCurrentPassword && (
        <label className="input-group">
          <FieldLabel label={t("currentPassword")} />
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
      )}
      <label className="input-group">
        <FieldLabel label={t("newPassword")} />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </label>
      <label className="input-group">
        <FieldLabel label={t("confirmPassword")} />
        <input
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-success" role="status">{status}</p>}
      <button className="save-work-submit-btn" disabled={busy}>
        {busy ? t("updatingPassword") : t("updatePassword")}
      </button>
    </form>
  );
}

// -------------------------------------------------------------
// SHARE SHEET (Single Work Receipt)
// -------------------------------------------------------------
function ShareSheet({ work, onClose }: { work: WorkRecord; onClose: () => void }) {
  const { language, t } = useLanguage();
  const customer = work.customer;
  const balance = balanceFor(work);
  const date = new Date(`${work.work_date}T00:00:00`).toLocaleDateString(
    language === "te" ? "te-IN-u-nu-latn" : "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );
  const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
  const receipt = `${t("receiptTitle")}\n\n${t("receiptFarmer")}: ${customer?.name ?? "-"}\n${t("receiptDate")}: ${date}\n${t("receiptWork")}: ${displayWorkType(work.work_type_name, language)}\n${t("sharedWorkDetails")}: ${work.quantity} ${unit} × ${money(work.rate)}\n\n${paymentStatus(balance)}\n\n${t("thankYou")}`;
  const phone = customer?.phone?.replace(/[^\d+]/g, "") ?? "";

  return (
    <div className="workflow-body">
      <section className="workflow-panel share-page">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{t("shareReceiptTitle")}</p>
            <h2>{customer?.name}</h2>
          </div>
          <IconButton icon={X} label={t("close")} onClick={onClose} />
        </div>
        <pre className="receipt">{receipt}</pre>
        <div className="share-actions">
          <a
            className="whatsapp-button"
            href={`https://wa.me/${phone}?text=${encodeURIComponent(receipt)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Whatsapp size={20} /> {t("sendWhatsApp")}
          </a>
          <a
            className="sms-button"
            href={`sms:${phone}?&body=${encodeURIComponent(receipt)}`}
          >
            <TelephoneFill size={18} /> {t("sendSms")}
          </a>
        </div>
        <button className="text-button" onClick={onClose}>{t("done")}</button>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER FULL STATEMENT SHARE SHEET
// -------------------------------------------------------------
function CustomerShareSheet({
  customer,
  works,
  onClose,
}: {
  customer: Customer;
  works: WorkRecord[];
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const dateLabel = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(
      language === "te" ? "te-IN-u-nu-latn" : "en-IN",
      { day: "numeric", month: "short", year: "numeric" }
    );
  const pendingWorks = works
    .map((work) => ({ work, balance: balanceFor(work) }))
    .filter(({ balance }) => balance > 0);
  const totalPending = pendingWorks.reduce((sum, { balance }) => sum + balance, 0);

  const labelLine = (label: string, value: string, bold: boolean) =>
    bold ? `*${label}:* ${value}` : `${label}: ${value}`;

  const buildStatement = (bold: boolean) => {
    const title = bold ? `*${t("customerStatementTitle")}*` : t("customerStatementTitle");
    const details = pendingWorks
      .map(({ work, balance }, index) => {
        const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
        return `${index + 1}.\n${labelLine(t("receiptWork"), displayWorkType(work.work_type_name, language), bold)}\n${labelLine(t("receiptDate"), dateLabel(work.work_date), bold)}\n${labelLine(t("sharedQuantity"), `${work.quantity} ${unit}`, bold)}\n${labelLine(t("receiptRate"), money(work.rate), bold)}\n${labelLine(t("remainingBalance"), money(balance), bold)}`;
      })
      .join("\n\n");

    const pendingSection = pendingWorks.length
      ? `${bold ? `*${t("sharedWorkDetails")}*` : t("sharedWorkDetails")}\n\n${details}\n\n${labelLine(t("payableBalanceLabel"), money(totalPending), bold)}\n\nPhonePe / Google Pay ద్వారా\n${bold ? "*9704200894*" : "9704200894"} నంబర్‌కు చెల్లించండి.\nచెల్లించే ముందు పేరు సరిచూసుకోండి.`
      : bold ? `*${t("noPendingBalance")}*` : t("noPendingBalance");

    return `${title}\n\n${labelLine(t("receiptFarmer"), customer.name, bold)}\n\n${pendingSection}\n\n${t("thankYou")}`;
  };

  const whatsappStatement = buildStatement(true);
  const smsStatement = buildStatement(false);
  const phone = customer.phone?.replace(/[^\d+]/g, "") ?? "";

  return (
    <div className="workflow-body">
      <section className="workflow-panel share-page" aria-labelledby="customer-share-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{customer.name}</p>
            <h2 id="customer-share-title">{t("shareAllDetails")}</h2>
          </div>
          <IconButton icon={X} label={t("close")} onClick={onClose} />
        </div>
        <div className="receipt statement-preview">
          <h3>{t("customerStatementTitle")}</h3>
          <p><strong>{t("receiptFarmer")}:</strong> {customer.name}</p>
          {pendingWorks.length ? (
            <>
              <h4>{t("sharedWorkDetails")}</h4>
              {pendingWorks.map(({ work, balance }, index) => {
                const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
                return (
                  <section className="statement-work" key={work.id}>
                    <b>{index + 1}.</b>
                    <p><strong>{t("receiptWork")}:</strong> {displayWorkType(work.work_type_name, language)}</p>
                    <p><strong>{t("receiptDate")}:</strong> {dateLabel(work.work_date)}</p>
                    <p><strong>{t("sharedQuantity")}:</strong> {work.quantity} {unit}</p>
                    <p><strong>{t("receiptRate")}:</strong> {money(work.rate)}</p>
                    <p className="statement-balance"><strong>{t("remainingBalance")}:</strong> {money(balance)}</p>
                  </section>
                );
              })}
              <p className="statement-total"><strong>{t("payableBalanceLabel")}:</strong> {money(totalPending)}</p>
              <div className="statement-payment">
                <p>PhonePe / Google Pay ద్వారా</p>
                <p><strong>9704200894</strong> నంబర్‌కు చెల్లించండి.</p>
                <p>చెల్లించే ముందు పేరు సరిచూసుకోండి.</p>
              </div>
            </>
          ) : (
            <p className="statement-clear"><strong>{t("noPendingBalance")}</strong></p>
          )}
          <p className="statement-thanks">{t("thankYou")}</p>
        </div>
        <div className="share-actions">
          <a
            className="whatsapp-button"
            href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsappStatement)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Whatsapp size={20} /> {t("sendWhatsApp")}
          </a>
          <a
            className="sms-button"
            href={`sms:${phone}?&body=${encodeURIComponent(smsStatement)}`}
          >
            <TelephoneFill size={18} /> {t("sendSms")}
          </a>
        </div>
        <button className="text-button" onClick={onClose}>{t("done")}</button>
      </section>
    </div>
  );
}
