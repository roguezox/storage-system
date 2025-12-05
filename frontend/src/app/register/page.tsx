'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
    const router = useRouter();
    const { register } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            await register(email, password);
            router.push('/dashboard');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            const axiosError = err as { response?: { data?: { error?: string } } };
            setError(axiosError.response?.data?.error || errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>📁 Drive</h1>
                    <p>Create your account</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                    />

                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                    />

                    <Input
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        required
                    />

                    <Button type="submit" isLoading={isLoading} className="w-full">
                        Create Account
                    </Button>
                </form>

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link href="/login">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
