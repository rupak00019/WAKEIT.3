"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const supabaseUrl = 'https://giekeskbbgbjacpgoiar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZWtlc2tiYmdiamFjcGdvaWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU1MjAsImV4cCI6MjA5Njg0MTUyMH0._H4sV-Z-aBU2_PB4-MDSvrd1ayUOplHufSPzaNVJre4';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: async_storage_1.default,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
