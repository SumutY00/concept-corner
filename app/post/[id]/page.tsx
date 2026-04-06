import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import PostDetail from './PostDetail'

async function getPostMeta(id: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )
  const { data } = await supabase
    .from('posts')
    .select('title, description, image_url, images, users(username), categories(name, icon)')
    .eq('id', id)
    .single()
  return data
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const post = await getPostMeta(id)

  if (!post) return { title: 'Concept Corner' }

  const title = post.title
  const description = post.description
    ?? `${(post.users as any)?.username ?? 'Biri'} tarafından paylaşılan konsept`
  const firstUrl = (post as any).images?.[0] ?? post.image_url ?? null
  const isVideo = firstUrl?.match(/\.(mp4|mov|webm|avi)$/i)
  const image = firstUrl && !isVideo ? firstUrl : null
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://conceptcorner.app'
  const url = `${siteUrl}/post/${id}`

  return {
    title: `${title} — Concept Corner`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Concept Corner',
      type: 'article',
      ...(image && {
        images: [{ url: image, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image] }),
    },
  }
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return <PostDetail params={params} />
}
