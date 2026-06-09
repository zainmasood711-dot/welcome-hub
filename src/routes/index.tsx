import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, LogOut, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import {
  createTask,
  deleteTask,
  listMyTasks,
  updateTask,
} from "@/lib/tasks.functions";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaskFlow — Team Tasks" },
      {
        name: "description",
        content: "Manage team tasks with status tracking, priorities, filters, and fast updates.",
      },
      { property: "og:title", content: "TaskFlow — Team Tasks" },
      {
        property: "og:description",
        content: "Manage team tasks with status tracking, priorities, filters, and fast updates.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const queryClient = useQueryClient();

  const fetchTasks = useServerFn(listMyTasks);
  const createTaskFn = useServerFn(createTask);
  const updateTaskFn = useServerFn(updateTask);
  const deleteTaskFn = useServerFn(deleteTask);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [sortBy, setSortBy] = useState<"newest" | "due_date" | "priority">("newest");

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  useQuery({
    queryKey: ["auth-changes"],
    queryFn: async () => {
      const { data } = supabase.auth.onAuthStateChange(() => {
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      });
      return data;
    },
    staleTime: Infinity,
  });

  const { data: tasks = [], isLoading } = useQuery<TaskItem[]>({
    queryKey: ["tasks", user?.id],
    queryFn: () => fetchTasks(),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: createTaskFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      toast.success("Task created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateTaskFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTaskFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredTasks = useMemo(() => {
    const searched = tasks.filter((task) => {
      const text = `${task.title} ${task.description ?? ""}`.toLowerCase();
      const searchMatch = text.includes(search.toLowerCase());
      const statusMatch = statusFilter === "all" || task.status === statusFilter;
      const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
      return searchMatch && statusMatch && priorityMatch;
    });

    return searched.sort((a, b) => {
      if (sortBy === "due_date") {
        const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }

      if (sortBy === "priority") {
        const order: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks, search, statusFilter, priorityFilter, sortBy]);

  const totals = useMemo(() => {
    return {
      all: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  const submitAuth = async () => {
    if (!email || !password) return;

    if (authMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return toast.error(error.message);
      toast.success("Signed in");
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return toast.error(error.message);
    toast.success("Account created");
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 md:px-8">
        <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">TaskFlow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                onClick={async () => {
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) toast.error(result.error.message);
                }}
              >
                Continue with Google
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={authMode === "signin" ? "default" : "outline"}
                  onClick={() => setAuthMode("signin")}
                >
                  Sign in
                </Button>
                <Button
                  variant={authMode === "signup" ? "default" : "outline"}
                  onClick={() => setAuthMode("signup")}
                >
                  Sign up
                </Button>
              </div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button className="w-full" onClick={submitAuth}>
                {authMode === "signin" ? "Access workspace" : "Create account"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Track tasks by status, priority, and due date.</p>
              <p>Filter and sort your queue instantly.</p>
              <p>Keep progress aligned with one shared board.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">TaskFlow</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              queryClient.invalidateQueries({ queryKey: ["auth-user"] });
            }}
          >
            <LogOut /> Sign out
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="All" value={totals.all} />
          <StatCard label="To do" value={totals.todo} />
          <StatCard label="In progress" value={totals.in_progress} />
          <StatCard label="Done" value={totals.done} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>New task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <Input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (!title.trim()) return toast.error("Title is required");
                  createMutation.mutate({
                    data: {
                      title: title.trim(),
                      description: description.trim() ? description.trim() : null,
                      priority,
                      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                    },
                  });
                }}
                disabled={createMutation.isPending}
              >
                <Plus /> Add task
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | TaskStatus)}
                >
                  <option value="all">All status</option>
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as "all" | TaskPriority)}
                >
                  <option value="all">All priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "due_date" | "priority")}
                >
                  <option value="newest">Newest</option>
                  <option value="due_date">Due date</option>
                  <option value="priority">Priority</option>
                </select>
              </div>

              {isLoading ? <p className="text-sm text-muted-foreground">Loading tasks...</p> : null}

              {!isLoading && filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks found.</p>
              ) : null}

              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <h2 className="font-medium text-foreground">{task.title}</h2>
                        {task.description ? (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <StatusBadge status={task.status} />
                          <PriorityBadge priority={task.priority} />
                          {task.due_date ? (
                            <Badge variant="outline">
                              Due {new Date(task.due_date).toLocaleDateString()}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={task.status}
                          onChange={(e) => {
                            updateMutation.mutate({
                              data: {
                                id: task.id,
                                status: e.target.value as TaskStatus,
                              },
                            });
                          }}
                        >
                          <option value="todo">To do</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={task.priority}
                          onChange={(e) => {
                            updateMutation.mutate({
                              data: {
                                id: task.id,
                                priority: e.target.value as TaskPriority,
                              },
                            });
                          }}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteMutation.mutate({ data: { id: task.id } })}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  if (status === "done") {
    return (
      <Badge className="gap-1" variant="secondary">
        <Check className="size-3" /> Done
      </Badge>
    );
  }

  if (status === "in_progress") {
    return <Badge variant="default">In progress</Badge>;
  }

  return <Badge variant="outline">To do</Badge>;
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "high") return <Badge variant="destructive">High</Badge>;
  if (priority === "medium") return <Badge variant="default">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}
