import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setLanguage, tr, useLanguage } from "@boardtestify/i18n";
import { NativeLanguageSwitch } from "../src/extras";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
export default function Layout() {
  useLanguage();
  useEffect(() => {
    AsyncStorage.getItem("bt-lang")
      .then((v) => {
        if (v) setLanguage(v);
      })
      .catch(() => {});
  }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#111113",
          },
          headerTintColor: "#f4f4f5",
          headerRight: () => <NativeLanguageSwitch />,
          contentStyle: {
            backgroundColor: "#09090b",
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="exam/[id]"
          options={{
            title: "BoardTestify · Examination",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="result/[id]"
          options={{
            title: "Your result",
          }}
        />
      </Stack>
    </>
  );
}
