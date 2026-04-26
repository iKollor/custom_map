import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { StoredStateSchema } from '@/components/map/editor/types'

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params

    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    try {
        const snapshot = await prisma.projectSnapshot.findUnique({
            where: { id: 'default' },
        })

        if (!snapshot || !snapshot.data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Primero intentar parsear como V2, si no como V1
        // (ya que StoredStateSchema.safeParse falla si es V1, habría que hacer migrate, 
        // pero para evitar lógica repetida, vamos a buscar manualmente en el JSON)
        
        const data = snapshot.data as any
        let projects = []
        if (data && Array.isArray(data.projects)) {
            projects = data.projects
        }

        const project = projects.find((p: any) => p.shareToken === token)

        if (!project) {
            return NextResponse.json({ error: 'Project not found or link is invalid' }, { status: 404 })
        }

        return NextResponse.json({
            project: {
                id: project.id,
                name: project.name,
                categories: project.categories,
                features: project.features
            }
        })

    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
