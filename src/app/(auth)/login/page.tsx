import { Suspense, type ReactElement } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage(): ReactElement {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
