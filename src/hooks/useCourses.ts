import { useProjects } from '@/hooks/useProjects';
import type { Course } from '@/lib/courses';

/** Courses live in the projects store; small helpers to read and change them. */
export function useCourses() {
  const p = useProjects();
  const courses = p.state.courses ?? [];
  return {
    ready: p.ready,
    courses,
    projects: p.state.projects,
    get: (id: string) => courses.find((c) => c.id === id),
    add: (course: Course) => p.apply((s) => ({ ...s, courses: [...(s.courses ?? []), course] })),
    update: (id: string, fn: (c: Course) => Course) => p.apply((s) => ({ ...s, courses: (s.courses ?? []).map((c) => (c.id === id ? fn(c) : c)) })),
    remove: (id: string) => p.apply((s) => ({ ...s, courses: (s.courses ?? []).filter((c) => c.id !== id) })),
  };
}
