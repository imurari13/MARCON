import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";

type Overtime = {
  _id: string;
  date: string;
  minutes: number;
  status: string;
  userId?: { name: string; employeeId: string } | string;
};

type Shift = {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  weeklyOff: number[];
};

type ShiftForm = {
  name: string;
  startTime: string;
  endTime: string;
  weeklyOff: string;
};

const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const emptyShift: ShiftForm = {
  name: "",
  startTime: "09:30",
  endTime: "18:30",
  weeklyOff: "0",
};

export default function OperationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<Overtime[] | null>(null);
  const [pending, setPending] = useState<Overtime[] | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [ot, setOt] = useState({ date: "", minutes: "" });
  const [shift, setShift] = useState<ShiftForm>(emptyShift);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const admin = user?.role === "CEO" || user?.role === "HR";
  const reviewer = admin || user?.role === "MANAGER";

  const load = useCallback(async () => {
    const [mine, all, shiftResponse] = await Promise.all([
      apiRequest<{ entries: Overtime[] }>("/operations/overtime/mine"),
      reviewer
        ? apiRequest<{ entries: Overtime[] }>("/operations/overtime")
        : Promise.resolve({ entries: [] }),
      apiRequest<{ shifts: Shift[] }>("/operations/shifts"),
    ]);
    setEntries(mine.entries);
    setPending(all.entries);
    setShifts(shiftResponse.shifts);
  }, [reviewer]);

  useEffect(() => {
    void load().catch((error: Error) => toast(error.message, "bad"));
  }, [load, toast]);

  async function submitOvertime(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/operations/overtime", {
        method: "POST",
        body: JSON.stringify({
          date: ot.date,
          minutes: Number(ot.minutes),
        }),
      });
      setOt({ date: "", minutes: "" });
      await load();
      toast("Overtime submitted");
    } catch (error) {
      toast((error as Error).message, "bad");
    }
  }

  async function reviewOvertime(id: string, action: "approve" | "reject") {
    try {
      await apiRequest(`/operations/overtime/${id}/${action}`, {
        method: "POST",
      });
      await load();
      toast(`Overtime ${action}d`);
    } catch (error) {
      toast((error as Error).message, "bad");
    }
  }

  function editShift(value: Shift) {
    setEditingShiftId(value._id);
    setShift({
      name: value.name,
      startTime: value.startTime,
      endTime: value.endTime,
      weeklyOff: value.weeklyOff.join(","),
    });
  }

  function cancelShiftEdit() {
    setEditingShiftId(null);
    setShift(emptyShift);
  }

  async function saveShift(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...shift,
      weeklyOff: shift.weeklyOff
        .split(",")
        .map((day) => Number(day.trim()))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    };

    try {
      await apiRequest(
        editingShiftId
          ? `/operations/shifts/${editingShiftId}`
          : "/operations/shifts",
        {
          method: editingShiftId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      cancelShiftEdit();
      await load();
      toast(editingShiftId ? "Shift updated" : "Shift created");
    } catch (error) {
      toast((error as Error).message, "bad");
    }
  }

  return (
    <>
      <PageHead title="Operations" sub="Shifts, weekly offs and overtime" />
      <Card>
        <h3>Log overtime</h3>
        <form className="grid-form" onSubmit={submitOvertime}>
          <label>
            Date
            <input
              required
              type="date"
              value={ot.date}
              onChange={(event) =>
                setOt({ ...ot, date: event.target.value })
              }
            />
          </label>
          <label>
            Minutes
            <input
              required
              type="number"
              min="1"
              max="960"
              value={ot.minutes}
              onChange={(event) =>
                setOt({ ...ot, minutes: event.target.value })
              }
            />
          </label>
          <button className="btn primary">Submit overtime</button>
        </form>
      </Card>

      <Card>
        <h3>My overtime</h3>
        {!entries ? (
          <Skeleton />
        ) : !entries.length ? (
          <Empty icon={<span>—</span>} text="No overtime entries" />
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id}>
                    <td>{entry.date}</td>
                    <td>
                      {Math.floor(entry.minutes / 60)}h {entry.minutes % 60}m
                    </td>
                    <td>
                      <Pill s={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {reviewer && (
        <Card>
          <h3>Overtime awaiting approval</h3>
          {!pending ? (
            <Skeleton />
          ) : !pending.length ? (
            <Empty icon={<span>—</span>} text="Nothing awaiting review" />
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {pending.map((entry) => (
                    <tr key={entry._id}>
                      <td>
                        <b>
                          {typeof entry.userId === "object"
                            ? entry.userId.name
                            : "Employee"}
                        </b>
                      </td>
                      <td>{entry.date}</td>
                      <td>{entry.minutes} min</td>
                      <td className="right">
                        <button
                          className="btn sm"
                          onClick={() =>
                            void reviewOvertime(entry._id, "approve")
                          }
                        >
                          Approve
                        </button>{" "}
                        <button
                          className="btn sm ghost"
                          onClick={() =>
                            void reviewOvertime(entry._id, "reject")
                          }
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {admin && (
        <Card>
          <h3>{editingShiftId ? "Edit shift" : "Create shift"}</h3>
          <form className="grid-form" onSubmit={saveShift}>
            <label>
              Name
              <input
                required
                value={shift.name}
                onChange={(event) =>
                  setShift({ ...shift, name: event.target.value })
                }
              />
            </label>
            <label>
              Start
              <input
                required
                type="time"
                value={shift.startTime}
                onChange={(event) =>
                  setShift({ ...shift, startTime: event.target.value })
                }
              />
            </label>
            <label>
              End
              <input
                required
                type="time"
                value={shift.endTime}
                onChange={(event) =>
                  setShift({ ...shift, endTime: event.target.value })
                }
              />
            </label>
            <label>
              Weekly offs (0–6)
              <input
                required
                value={shift.weeklyOff}
                onChange={(event) =>
                  setShift({ ...shift, weeklyOff: event.target.value })
                }
              />
            </label>
            <button className="btn primary">
              {editingShiftId ? "Save changes" : "Create shift"}
            </button>
            {editingShiftId && (
              <button
                className="btn ghost"
                type="button"
                onClick={cancelShiftEdit}
              >
                Cancel
              </button>
            )}
          </form>
          {!shifts ? (
            <Skeleton rows={1} />
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {shifts.map((value) => (
                    <tr key={value._id}>
                      <td>
                        <b>{value.name}</b>
                      </td>
                      <td>
                        {value.startTime} – {value.endTime}
                      </td>
                      <td>
                        {value.weeklyOff.map((day) => weekday[day]).join(", ")}
                      </td>
                      <td className="right">
                        <button
                          className="btn sm"
                          type="button"
                          onClick={() => editShift(value)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
