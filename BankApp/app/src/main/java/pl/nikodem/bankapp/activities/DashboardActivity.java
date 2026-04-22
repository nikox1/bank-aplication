package pl.nikodem.bankapp.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import pl.nikodem.bankapp.R;
import pl.nikodem.bankapp.api.RetrofitClient;
import pl.nikodem.bankapp.models.Account;
import pl.nikodem.bankapp.models.LoginResponse;
import pl.nikodem.bankapp.models.User;
import pl.nikodem.bankapp.utils.SharedPrefManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DashboardActivity extends AppCompatActivity {

    private TextView tvUserName, tvBalance, tvAccountNumber;
    private LinearLayout btnTransfer, btnBlik, btnHistory;
    private Button btnLogout;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard);

        if (!SharedPrefManager.getInstance(this).isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupListeners();
        loadUserData();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshBalance();
    }

    private void initViews() {
        tvUserName = findViewById(R.id.tvUserName);
        tvBalance = findViewById(R.id.tvBalance);
        tvAccountNumber = findViewById(R.id.tvAccountNumber);
        btnTransfer = findViewById(R.id.btnTransfer);
        btnBlik = findViewById(R.id.btnBlik);
        btnHistory = findViewById(R.id.btnHistory);
        btnLogout = findViewById(R.id.btnLogout);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupListeners() {
        btnTransfer.setOnClickListener(v -> {
            startActivity(new Intent(DashboardActivity.this, TransferActivity.class));
        });

        btnBlik.setOnClickListener(v -> {
            startActivity(new Intent(DashboardActivity.this, BlikActivity.class));
        });

        btnHistory.setOnClickListener(v -> {
            startActivity(new Intent(DashboardActivity.this, HistoryActivity.class));
        });

        btnLogout.setOnClickListener(v -> {
            SharedPrefManager.getInstance(DashboardActivity.this).clear();
            startActivity(new Intent(DashboardActivity.this, LoginActivity.class));
            finishAffinity();
        });
    }

    private void loadUserData() {
        User user = SharedPrefManager.getInstance(this).getUser();
        Account account = SharedPrefManager.getInstance(this).getAccount();

        tvUserName.setText(user.getName());
        tvBalance.setText(formatCurrency(account.getBalance()));
        tvAccountNumber.setText(account.getAccountNumber());
    }

    private void refreshBalance() {
        String token = "Bearer " + SharedPrefManager.getInstance(this).getToken();

        RetrofitClient.getInstance().getApiService()
                .getBalance(token)
                .enqueue(new Callback<LoginResponse>() {
                    @Override
                    public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            LoginResponse body = response.body();
                            if (body.getAccount() != null) {
                                double balance = body.getAccount().getBalance();
                                tvBalance.setText(formatCurrency(balance));
                                SharedPrefManager.getInstance(DashboardActivity.this).updateBalance(balance);
                            }
                        }
                    }

                    @Override
                    public void onFailure(Call<LoginResponse> call, Throwable t) {
                            Toast.makeText(DashboardActivity.this,
                                    "Failed to refresh balance: " + t.getMessage(),
                                    Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private String formatCurrency(double amount) {
        return String.format("%.2f PLN", amount);
    }
}
