import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import { useAuth } from "../context/AuthContext";
import { useInteractions, useReveal } from "../hooks/useMotion";
import { reduced } from "../lib/gsap";
import { Avatar } from "./ui";
import Embers from "./Embers";
import { IconBell, IconBriefcase, IconCalendar, IconCalendarDays, IconChart, IconClock, IconHome, IconLogout, IconSettings, IconShield, IconUsers } from "./Icons";

export default function Layout() {
  const { user, logout } = useAuth();
  const main = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setMore(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    // Warm the most-used page chunks while the browser is idle so navigation feels instant.
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 800));
    idle(() => { void import("../pages/AttendancePage"); void import("../pages/LeavePage"); void import("../pages/CalendarPage"); void import("../pages/HolidaysPage"); });
  }, []);

  useReveal(main, [pathname]);
  useInteractions();

  useLayoutEffect(() => {
    const a = nav.current?.querySelector<HTMLElement>("a.active");
    if (!a || !bar.current) return;
    const props = { y: a.offsetTop, height: a.offsetHeight, opacity: 1 };
    if (reduced()) gsap.set(bar.current, props);
    else gsap.to(bar.current, { ...props, duration: 0.7, ease: "expo.out" });
  }, [pathname]);

  // Nav labels decode themselves on hover.
  useEffect(() => {
    if (reduced() || !nav.current) return;
    const cleanups = Array.from(nav.current.querySelectorAll<HTMLAnchorElement>("a")).map((a) => {
      const span = a.querySelector("span");
      if (!span) return () => {};
      const text = span.textContent ?? "";
      const over = () => gsap.to(span, { duration: 0.6, scrambleText: { text, chars: "01▓▒░", speed: 0.8 }, overwrite: true });
      a.addEventListener("pointerenter", over);
      return () => a.removeEventListener("pointerenter", over);
    });
    return () => cleanups.forEach((f) => f());
  }, [user]);

  if (!user) return null;
  const admin = user.role === "CEO" || user.role === "HR";
  const link = (to: string, icon: ReactNode, label: string) => <NavLink to={to}>{icon}<span>{label}</span></NavLink>;
  const more_links: [string, ReactNode, string][] = [
    ["/holidays", <IconCalendarDays />, "Holidays"],
    ["/work-from-home", <IconBriefcase />, "Work from home"],
    ...(admin ? ([["/employees", <IconUsers />, "People"], ["/admin", <IconSettings />, "Admin"], ["/reports", <IconChart />, "Reports"], ["/corrections", <IconClock />, "Corrections"]] as [string, ReactNode, string][]) : []),
    ["/work", <IconBriefcase />, "Work hub"], ["/updates", <IconBell />, "Updates"], ["/payroll", <IconBriefcase />, "Payroll"], ["/documents", <IconBriefcase />, "Documents"],
    ["/performance", <IconUsers />, "Performance"], ["/operations", <IconSettings />, "Operations"], ["/security", <IconShield />, "Security"],
    ["/profile", <IconUsers />, "My profile"],
  ];
  const tab = (to: string, icon: ReactNode, label: string) => <NavLink to={to} className="tab">{icon}<span>{label}</span></NavLink>;

  return (
    <>
      {!reduced() && <Embers fixed intensity={0.55} />}
      <div className="shell">
        <aside>
          <div className="logo">
            <img src="/marcamor-logo.png" width="197" height="46" alt="Marcamor" />
            <small>MarcOn</small>
          </div>
          <nav ref={nav}>
            <span ref={bar} className="indicator" />
            {link("/dashboard", <IconHome />, "Overview")}
            {link("/attendance", <IconClock />, "Attendance")}
            {link("/leave", <IconCalendar />, "Leave")}
            {link("/work-from-home", <IconBriefcase />, "Work from home")}
            {link("/calendar", <IconCalendarDays />, "Calendar")}
            {link("/holidays", <IconCalendarDays />, "Holidays")}
            {admin && link("/employees", <IconUsers />, "People")}
            {admin && link("/admin", <IconSettings />, "Admin")}
            {admin && link("/reports", <IconChart />, "Reports")}
            {admin && link("/corrections", <IconClock />, "Corrections")}
            <>{link("/work", <IconBriefcase />, "Work hub")}</>
            <>{link("/security", <IconShield />, "Security")}</>
            <>{link("/updates", <IconBell />, "Updates")}</>
            <>{link("/operations", <IconSettings />, "Operations")}</>
            <>{link("/payroll", <IconBriefcase />, "Payroll")}</>
            <>{link("/documents", <IconBriefcase />, "Documents")}</>
            <>{link("/performance", <IconUsers />, "Performance")}</>
            <>{link("/profile", <IconUsers />, "My profile")}</>
          </nav>
          <div className="side-foot">
            <div className="me">
              <Avatar name={user.fullName} />
              <div><b>{user.fullName}</b><small>{user.role.toLowerCase()}</small></div>
              <button className="icon-btn" onClick={() => void logout()} aria-label="Sign out"><IconLogout /></button>
            </div>
          </div>
        </aside>
        <header className="topbar">
          <img src="/marcamor-logo.png" width="197" height="46" alt="Marcamor" />
          <div className="topbar-r">
            <NavLink to="/updates" className="icon-btn" aria-label="Updates"><IconBell /></NavLink>
            <button className="icon-btn" onClick={() => void logout()} aria-label="Sign out"><IconLogout /></button>
          </div>
        </header>
        <main ref={main}><Suspense fallback={<div className="loading">Loading…</div>}><Outlet /></Suspense></main>
      </div>
      <nav className="tabbar" aria-label="Primary">
        {tab("/dashboard", <IconHome />, "Home")}
        {tab("/attendance", <IconClock />, "Attendance")}
        {tab("/leave", <IconCalendar />, "Leave")}
        {tab("/calendar", <IconCalendarDays />, "Calendar")}
        <button className={`tab${more ? " active" : ""}`} onClick={() => setMore((v) => !v)} aria-expanded={more}><IconSettings /><span>More</span></button>
      </nav>
      {more && (
        <>
          <div className="sheet-scrim" onClick={() => setMore(false)} />
          <div className="sheet" role="dialog" aria-label="More">
            <div className="sheet-me"><Avatar name={user.fullName} /><div><b>{user.fullName}</b><small>{user.role.toLowerCase()}</small></div></div>
            <div className="sheet-grid">
              {more_links.map(([to, icon, label]) => <NavLink key={to} to={to}>{icon}<span>{label}</span></NavLink>)}
            </div>
            <button className="btn wide" onClick={() => void logout()}><IconLogout /> Sign out</button>
          </div>
        </>
      )}
    </>
  );
}
