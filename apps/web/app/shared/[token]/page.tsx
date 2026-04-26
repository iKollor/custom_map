import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SharedMapClientLoader from '@/components/map/SharedMapClientLoader'

interface SharedPageProps {
    params: Promise<{ token: string }>
}

async function getProjectByToken(token: string) {
    if (!token) return null

    try {
        const snapshot = await prisma.projectSnapshot.findUnique({
            where: { id: 'default' },
        })

        if (!snapshot || !snapshot.data) return null

        const data = snapshot.data as any
        let projects = []
        if (data && Array.isArray(data.projects)) {
            projects = data.projects
        }

        const project = projects.find((p: any) => p.shareToken === token)
        
        if (!project) return null

        return {
            id: project.id,
            name: project.name,
            categories: project.categories,
            features: project.features
        }
    } catch (e) {
        return null
    }
}

export async function generateMetadata({ params }: SharedPageProps): Promise<Metadata> {
    const { token } = await params
    const project = await getProjectByToken(token)

    if (project) {
        return {
            title: `${project.name} | iKollor Maps`,
            description: `Vista compartida de ${project.name}`,
        }
    }

    return {
        title: 'Mapa Compartido | iKollor Maps'
    }
}

export default async function SharedMapPage({ params }: SharedPageProps) {
    const { token } = await params
    const project = await getProjectByToken(token)

    if (!project) {
        notFound()
    }

    return <SharedMapClientLoader project={project as any} />
}
