import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

import DeleteUser from '@/components/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Profile settings',
        href: edit().url,
    },
];

// ── Avatar cropper ────────────────────────────────────────────────────────────
const CROP_SIZE = 220; // diameter of the crop circle in px

function AvatarCropper({ src, onSave, onCancel }: { src: string; onSave: (blob: Blob) => void; onCancel: () => void }) {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);

    const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
    const lastPinchRef = useRef<number | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // When the image first loads, auto-fit it to fill the crop circle
    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;
        const fit = () => {
            const s = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
            setScale(s);
            setPos({ x: 0, y: 0 });
        };
        if (img.complete) fit();
        else img.onload = fit;
    }, [src]);

    // ── Mouse pan ────────────────────────────────────────────────────────────
    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragRef.current) return;
        setPos({
            x: dragRef.current.px + (e.clientX - dragRef.current.mx),
            y: dragRef.current.py + (e.clientY - dragRef.current.my),
        });
    };
    const onMouseUp = () => { dragRef.current = null; };

    // ── Scroll zoom ──────────────────────────────────────────────────────────
    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setScale(s => Math.max(0.2, Math.min(10, s * (1 - e.deltaY * 0.001))));
    };

    // ── Touch pan + pinch zoom ────────────────────────────────────────────────
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchRef.current = Math.hypot(dx, dy);
        }
    };
    const onTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && lastTouchRef.current) {
            const dx = e.touches[0].clientX - lastTouchRef.current.x;
            const dy = e.touches[0].clientY - lastTouchRef.current.y;
            setPos(p => ({ x: p.x + dx, y: p.y + dy }));
            lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && lastPinchRef.current !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            setScale(s => Math.max(0.2, Math.min(10, s * (dist / lastPinchRef.current!))));
            lastPinchRef.current = dist;
        }
    };
    const onTouchEnd = () => { lastTouchRef.current = null; lastPinchRef.current = null; };

    // ── Save: draw to canvas and export ──────────────────────────────────────
    const handleSave = () => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || !img.complete) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
        ctx.beginPath();
        ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        const iw = img.naturalWidth * scale;
        const ih = img.naturalHeight * scale;
        const ox = CROP_SIZE / 2 + pos.x - iw / 2;
        const oy = CROP_SIZE / 2 + pos.y - ih / 2;
        ctx.drawImage(img, ox, oy, iw, ih);

        canvas.toBlob(blob => { if (blob) onSave(blob); }, 'image/jpeg', 0.92);
    };

    return (
        <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Drag to reposition · scroll or pinch to zoom
            </p>

            {/* Crop viewport */}
            <div
                className="relative overflow-hidden rounded-full select-none"
                style={{ width: CROP_SIZE, height: CROP_SIZE, background: '#18181b', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onWheel={onWheel}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Circle outline */}
                <div
                    className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-cyan-400/60 z-10"
                />
                <img
                    ref={imgRef}
                    src={src}
                    draggable={false}
                    alt="Crop preview"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
                        transformOrigin: 'center center',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        maxWidth: 'none',
                    }}
                />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-2 w-full max-w-[220px]">
                <span className="text-xs text-zinc-400">−</span>
                <input
                    type="range"
                    min={20}
                    max={500}
                    value={Math.round(scale * 100)}
                    onChange={e => setScale(Number(e.target.value) / 100)}
                    className="flex-1 accent-cyan-400"
                />
                <span className="text-xs text-zinc-400">+</span>
            </div>

            <canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} style={{ display: 'none' }} />

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition"
                >
                    Save photo
                </button>
            </div>
        </div>
    );
}

// ── Profile page ──────────────────────────────────────────────────────────────
export default function Profile({ mustVerifyEmail, status }: { mustVerifyEmail: boolean; status?: string }) {
    const { auth } = usePage<SharedData>().props;
    const fileRef = useRef<HTMLInputElement>(null);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCropSrc(URL.createObjectURL(file));
    };

    const handleCropSave = (blob: Blob) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('avatar', blob, 'avatar.jpg');
        router.post('/settings/profile/avatar', formData, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploading(false);
                setCropSrc(null);
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    const handleCropCancel = () => {
        setCropSrc(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleRemove = () => {
        router.delete('/settings/profile/avatar', { preserveScroll: true });
    };

    const currentAvatarUrl = (auth.user.avatar_url as string | null | undefined) ?? null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Profile information" description="Update your name and email address" />

                    {/* Avatar section */}
                    {cropSrc ? (
                        uploading ? (
                            <p className="text-sm text-zinc-400">Uploading…</p>
                        ) : (
                            <AvatarCropper
                                src={cropSrc}
                                onSave={handleCropSave}
                                onCancel={handleCropCancel}
                            />
                        )
                    ) : (
                        <div className="flex items-center gap-4">
                            <PlayerAvatar
                                id={auth.user.id}
                                name={auth.user.name}
                                size={80}
                                avatarUrl={currentAvatarUrl}
                            />
                            <div className="flex flex-col gap-2">
                                <Label className="cursor-pointer">
                                    <Input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <span className="inline-block px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition cursor-pointer">
                                        {currentAvatarUrl ? 'Change photo' : 'Upload photo'}
                                    </span>
                                </Label>
                                {currentAvatarUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRemove}
                                        className="text-xs text-red-500 hover:underline text-left"
                                    >
                                        Remove photo
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <Form
                        {...ProfileController.update.form()}
                        options={{ preserveScroll: true }}
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        className="mt-1 block w-full"
                                        defaultValue={auth.user.name}
                                        name="name"
                                        required
                                        autoComplete="name"
                                        placeholder="Full name"
                                    />
                                    <InputError className="mt-2" message={errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        defaultValue={auth.user.email}
                                        name="email"
                                        required
                                        autoComplete="username"
                                        placeholder="Email address"
                                    />
                                    <InputError className="mt-2" message={errors.email} />
                                </div>

                                {mustVerifyEmail && auth.user.email_verified_at === null && (
                                    <div>
                                        <p className="-mt-4 text-sm text-muted-foreground">
                                            Your email address is unverified.{' '}
                                            <Link
                                                href={send()}
                                                as="button"
                                                className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                            >
                                                Click here to resend the verification email.
                                            </Link>
                                        </p>
                                        {status === 'verification-link-sent' && (
                                            <div className="mt-2 text-sm font-medium text-green-600">
                                                A new verification link has been sent to your email address.
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-4">
                                    <Button disabled={processing}>Save</Button>
                                    <Transition
                                        show={recentlySuccessful}
                                        enter="transition ease-in-out"
                                        enterFrom="opacity-0"
                                        leave="transition ease-in-out"
                                        leaveTo="opacity-0"
                                    >
                                        <p className="text-sm text-neutral-600">Saved</p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
