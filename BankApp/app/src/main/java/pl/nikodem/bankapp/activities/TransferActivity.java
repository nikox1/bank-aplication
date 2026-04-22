package pl.nikodem.bankapp.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import pl.nikodem.bankapp.R;
import pl.nikodem.bankapp.api.RetrofitClient;
import pl.nikodem.bankapp.models.ApiResponse;
import pl.nikodem.bankapp.utils.SharedPrefManager;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class TransferActivity extends AppCompatActivity {

    private EditText etToAccount, etAmount, etTitle;
    private Button btnSend;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_transfer);

        initViews();
        setupListeners();
    }

    private void initViews() {
        etToAccount = findViewById(R.id.etToAccount);
        etAmount = findViewById(R.id.etAmount);
        etTitle = findViewById(R.id.etTitle);
        btnSend = findViewById(R.id.btnSend);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupListeners() {
        btnSend.setOnClickListener(v -> makeTransfer());

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
    }

    private void makeTransfer() {
        String toAccount = etToAccount.getText().toString().trim();
        String amountStr = etAmount.getText().toString().trim();
        String title = etTitle.getText().toString().trim();

        if (toAccount.isEmpty()) {
            etToAccount.setError("Account number is required");
            etToAccount.requestFocus();
            return;
        }

        if (amountStr.isEmpty()) {
            etAmount.setError("Amount is required");
            etAmount.requestFocus();
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(amountStr);
            if (amount <= 0) {
                etAmount.setError("Amount must be positive");
                etAmount.requestFocus();
                return;
            }
        } catch (NumberFormatException e) {
            etAmount.setError("Invalid amount");
            etAmount.requestFocus();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnSend.setEnabled(false);

        Map<String, Object> body = new HashMap<>();
        body.put("toAccount", toAccount);
        body.put("amount", amount);
        body.put("title", title.isEmpty() ? "Transfer" : title);

        String token = "Bearer " + SharedPrefManager.getInstance(this).getToken();

        RetrofitClient.getInstance().getApiService()
                .transfer(token, body)
                .enqueue(new Callback<ApiResponse>() {
                    @Override
                    public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                        progressBar.setVisibility(View.GONE);
                        btnSend.setEnabled(true);

                        if (response.isSuccessful() && response.body() != null) {
                            ApiResponse apiResponse = response.body();

                            if (apiResponse.isSuccess()) {
                                Toast.makeText(TransferActivity.this,
                                        "Transfer completed successfully!",
                                        Toast.LENGTH_SHORT).show();
                                etToAccount.setText("");
                                etAmount.setText("");
                                etTitle.setText("");
                                finish();
                            } else {
                                Toast.makeText(TransferActivity.this,
                                        apiResponse.getError(),
                                        Toast.LENGTH_SHORT).show();
                            }
                        } else {
                            Toast.makeText(TransferActivity.this,
                                    "Transfer failed. Please try again.",
                                    Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<ApiResponse> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        btnSend.setEnabled(true);
                        Toast.makeText(TransferActivity.this,
                                "Connection error: " + t.getMessage(),
                                Toast.LENGTH_SHORT).show();
                    }
                });
    }
}
