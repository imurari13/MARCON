import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Skeleton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

type Doc = { _id: string; name: string; category: string; createdAt: string; storagePath?: string; url: string };
type Employee = { _id: string; name: string; employeeId: string };

export default function DocumentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const admin = user?.role === "CEO" || user?.role === "HR";
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [target, setTarget] = useState(user?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("ID proof");

  const load = useCallback(async () => {
    if (!target) return;
    setDocs((await apiRequest<{ documents: Doc[] }>(`/communications/documents/${target}`)).documents);
    if (admin) setEmployees((await apiRequest<{ employees: Employee[] }>("/employees")).employees);
  }, [admin, target]);

  useEffect(() => { void load().catch((error: Error) => toast(error.message, "bad")); }, [load, toast]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Unable to read file"));
        reader.readAsDataURL(file);
      });
      await apiRequest("/communications/documents/upload", {
        method: "POST",
        body: JSON.stringify({ userId: target, name: file.name, category, mimeType: file.type, data }),
      });
      setFile(null);
      await load();
      toast("Document uploaded");
    } catch (error) {
      toast((error as Error).message, "bad");
    }
  }

  return (
    <>
      <PageHead title="Documents" sub="Your secure employment document vault" />
      {admin && <Card><h3>Employee</h3><label>View or upload for
        <select value={target} onChange={event => setTarget(event.target.value)}>
          {employees.map(employee => <option key={employee._id} value={employee._id}>{employee.name} ({employee.employeeId})</option>)}
        </select>
      </label></Card>}
      {admin && <Card><h3>Upload document</h3>
        <form className="grid-form" onSubmit={upload}>
          <label>Category<input required value={category} onChange={event => setCategory(event.target.value)} /></label>
          <label>File<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={choose} /></label>
          <button className="btn primary" disabled={!file}>Upload</button>
        </form>
      </Card>}
      <Card><h3>Vault</h3>
        {!docs ? <Skeleton /> : !docs.length ? <Empty icon={<span>—</span>} text="No documents available" /> : (
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>Uploaded</th><th /></tr></thead>
            <tbody>{docs.map(document => <tr key={document._id}>
              <td><b>{document.name}</b></td><td>{document.category}</td><td>{new Date(document.createdAt).toLocaleDateString()}</td>
              <td className="right">{document.storagePath
                ? <a className="btn sm" href={`/api/communications/documents/${document._id}/download`}>Download</a>
                : <a className="btn sm" href={document.url} target="_blank" rel="noreferrer">Open link</a>}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
