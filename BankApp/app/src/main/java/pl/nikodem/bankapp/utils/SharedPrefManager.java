package pl.nikodem.bankapp.utils;

import android.content.Context;
import android.content.SharedPreferences;

import pl.nikodem.bankapp.models.Account;
import pl.nikodem.bankapp.models.User;

public class SharedPrefManager {

    private static final String SHARED_PREF_NAME = "bank_app_prefs";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_EMAIL = "user_email";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_ACCOUNT_ID = "account_id";
    private static final String KEY_ACCOUNT_NUMBER = "account_number";
    private static final String KEY_ACCOUNT_BALANCE = "account_balance";

    private static SharedPrefManager instance;
    private SharedPreferences sharedPreferences;

    private SharedPrefManager(Context context) {
        sharedPreferences = context.getSharedPreferences(SHARED_PREF_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized SharedPrefManager getInstance(Context context) {
        if (instance == null) {
            instance = new SharedPrefManager(context.getApplicationContext());
        }
        return instance;
    }

    public void saveUser(String token, User user, Account account) {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(KEY_TOKEN, token);
        editor.putInt(KEY_USER_ID, user.getId());
        editor.putString(KEY_USER_EMAIL, user.getEmail());
        editor.putString(KEY_USER_NAME, user.getName());
        if (account != null) {
            editor.putInt(KEY_ACCOUNT_ID, account.getId());
            editor.putString(KEY_ACCOUNT_NUMBER, account.getAccountNumber());
            editor.putFloat(KEY_ACCOUNT_BALANCE, (float) account.getBalance());
        }
        editor.apply();
    }

    public User getUser() {
        User user = new User();
        user.setId(sharedPreferences.getInt(KEY_USER_ID, -1));
        user.setEmail(sharedPreferences.getString(KEY_USER_EMAIL, null));
        user.setName(sharedPreferences.getString(KEY_USER_NAME, null));
        return user;
    }

    public Account getAccount() {
        Account account = new Account();
        account.setId(sharedPreferences.getInt(KEY_ACCOUNT_ID, -1));
        account.setAccountNumber(sharedPreferences.getString(KEY_ACCOUNT_NUMBER, null));
        account.setBalance(sharedPreferences.getFloat(KEY_ACCOUNT_BALANCE, 0));
        return account;
    }

    public String getToken() {
        return sharedPreferences.getString(KEY_TOKEN, null);
    }

    public void updateBalance(double balance) {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putFloat(KEY_ACCOUNT_BALANCE, (float) balance);
        editor.apply();
    }

    public boolean isLoggedIn() {
        return getToken() != null;
    }

    public void clear() {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.clear();
        editor.apply();
    }
}
