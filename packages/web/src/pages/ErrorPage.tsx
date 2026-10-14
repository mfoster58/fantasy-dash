import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export default function ErrorPage() {
  const err = useRouteError();
  const message = isRouteErrorResponse(err)
    ? `${err.status} ${err.statusText || (err.status === 404 ? 'Not found' : '')}`.trim()
    : 'Something went wrong';
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center">
      <p className="text-2xl font-semibold">{message}</p>
      <Link to="/" className="mt-4 inline-block text-accent">Back to the dashboard</Link>
    </div>
  );
}
