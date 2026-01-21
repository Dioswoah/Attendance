import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const isAuth = !!req.auth
    const isAuthPage = req.nextUrl.pathname === "/"
    const isProtectedPage = (req.nextUrl.pathname.startsWith("/user") || req.nextUrl.pathname.startsWith("/admin")) && !req.nextUrl.pathname.startsWith("/admin-login")

    // 1. If user is NOT logged in and trying to access protected page
    if (isProtectedPage && !isAuth) {
        let from = req.nextUrl.pathname;
        if (req.nextUrl.search) {
            from += req.nextUrl.search;
        }

        const url = new URL("/", req.url);
        url.searchParams.set("error", "unauthorized");
        url.searchParams.set("callbackUrl", from);
        return NextResponse.redirect(url);
    }

    // 2. If user IS logged in and trying to access login page
    if (isAuthPage && isAuth) {
        return NextResponse.redirect(new URL("/user", req.url))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
