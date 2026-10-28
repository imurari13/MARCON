import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const label = (value: string | null | undefined, fallback = "Not added") => value || fallback;

export default function ProfilePage() {
  const { user } = useAuth();
  const joined = useMemo(() => user?.employeeCode ? `ID · ${user.employeeCode}` : "MARCON TEAM", [user]);
  if (!user) return null;

  const department = user.departmentId ? `Team ${user.departmentId.slice(-6).toUpperCase()}` : "Marcamor team";
  const skills = [department, user.designation || "People first", "Collaboration", "Growth mindset"];
  const start = user.workStartTime?.slice(0, 5) || "09:00";
  const end = user.workEndTime?.slice(0, 5) || "18:00";

  return (
    <div className="profile-page">
      <section className="profile-hero" data-r>
        <div className="profile-topline"><span>MARCON / PEOPLE FILE</span><span className="profile-available"><i /> ACTIVE TODAY</span></div>
        <p className="profile-ghost" aria-hidden="true">PROFILE</p>
        <div className="profile-hero-content">
          <div className="profile-intro">
            <p className="profile-kicker">Hello, I’m</p>
            <h1>{user.fullName}</h1>
            <p className="profile-role">{label(user.designation, user.role)} <em>at</em> Marcamor</p>
            <p className="profile-copy">A considered snapshot of the person behind the work—focused, connected, and moving the team forward.</p>
          </div>
          <div className="profile-portrait" aria-label={`${user.fullName}'s monogram`}>
            <div className="profile-portrait-ring" />
            <span>{initials(user.fullName)}</span>
            <small>{joined}</small>
          </div>
          <dl className="profile-stats">
            <div><dt>ROLE</dt><dd>{user.role}</dd></div>
            <div><dt>DEPARTMENT</dt><dd>{department}</dd></div>
            <div><dt>WORKING HOURS</dt><dd>{start} — {end}</dd></div>
          </dl>
        </div>
        <div className="profile-rule" />
      </section>

      <div className="profile-grid">
        <section className="profile-panel profile-about" data-r>
          <p className="profile-index">01 / ABOUT</p>
          <h2>Built to make a mark.</h2>
          <p>Every role carries a point of view. This profile keeps the essential details in one clear place, so your team can get to know the person behind the title.</p>
          <div className="profile-tags" aria-label="Professional strengths">
            {skills.map((skill) => <span key={skill}>{skill}</span>)}
          </div>
        </section>

        <section className="profile-panel profile-details" data-r>
          <p className="profile-index">02 / DETAILS</p>
          <div className="profile-detail-row"><span>WORK EMAIL</span><a href={`mailto:${user.email}`}>{user.email}</a></div>
          <div className="profile-detail-row"><span>EMPLOYEE CODE</span><b>{user.employeeCode}</b></div>
          <div className="profile-detail-row"><span>DATE OF BIRTH</span><b>{user.dateOfBirth ? new Date(`${user.dateOfBirth}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "long" }) : "Not added"}</b></div>
          <div className="profile-detail-row"><span>REPORTS TO</span><b>{user.managerId ? "Manager assigned" : "Independent contributor"}</b></div>
        </section>

        <section className="profile-panel profile-path" data-r>
          <p className="profile-index">03 / YOUR WORKDAY</p>
          <div className="profile-timeline">
            <div><i>01</i><span>START</span><b>{start}</b></div>
            <div><i>02</i><span>MAKE AN IMPACT</span><b>Focused work</b></div>
            <div><i>03</i><span>WRAP UP</span><b>{end}</b></div>
          </div>
        </section>

        <aside className="profile-cta" data-r>
          <span className="profile-quote">“</span>
          <p>Good work is the result of people feeling seen, trusted, and ready to contribute.</p>
          <small>YOUR MARCON PROFILE</small>
          <Link to="/security" className="profile-security-link">ACCOUNT SECURITY <b>→</b></Link>
        </aside>
      </div>
    </div>
  );
}
