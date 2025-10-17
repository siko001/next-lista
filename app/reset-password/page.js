"use client";
import {useSearchParams} from "next/navigation";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const key = searchParams.get("key");
  const login = searchParams.get("login");
  return <ResetPasswordClient token={token} resetKey={key} login={login} />;
}
